from fastapi import FastAPI, APIRouter, HTTPException, Header, Response, UploadFile, File, Query, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
import asyncio
import resend
import io
import csv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Resend settings
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============= MODELS =============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "Setter"  # Admin, Setter, Closer

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    picture: Optional[str] = None
    created_at: datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: User

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: str
    session_token: str

class LeadBase(BaseModel):
    lead_name: str
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: Optional[str] = None  # Referral, Inbound, Outbound, Upwork/Toptal/etc., Partner, Other
    qualifier_name: Optional[str] = None  # Was setter_name
    closer_name: Optional[str] = None
    status: str = "New"  # New, Discovery Call Booked, Proposal/SOW Sent, Contract Sent, Deposit Paid, Follow-Up Ongoing, Won, Lost
    
    # Dates
    first_contact_datetime: Optional[datetime] = None
    date_discovery_booked: Optional[datetime] = None  # Was date_meeting_booked
    date_of_discovery_call: Optional[datetime] = None  # Was date_of_meeting
    last_touch_date: Optional[datetime] = None
    
    # Discovery Call Status
    discovery_call_status: Optional[str] = None  # Show, No-Show, Rescheduled By Us, Rescheduled By Them, Cancel, DQ
    
    # Call outcome
    proposal_sent: bool = False  # Was offer_made
    close_type: Optional[str] = None  # Single-Call Close, Follow-Up Close (was sale_type)
    
    # Project scope
    project_type: Optional[str] = None  # Fixed-Scope Build, Retainer, Staff Augmentation, Ongoing Support
    technology_used: Optional[str] = None
    estimated_timeline: Optional[str] = None  # Free text: "3 weeks", "6 months", etc.
    
    # Loss Reason (required if Lost)
    loss_reason: Optional[str] = None  # Budget, Timeline, Went In-House, Chose Competitor, Ghosted, Not Qualified
    
    # Payment Type
    payment_type: str = "One-Time"  # One-Time or Recurring
    
    # Money — One-Time
    deposit_amount: float = 0.0
    total_deal_value: float = 0.0  # Total Contract Value for one-time
    cash_collected: float = 0.0
    date_paid_in_full: Optional[datetime] = None
    refund_clawback_amount: float = 0.0
    commission_percent: float = 0.0
    
    # Money — Recurring
    monthly_retainer_amount: float = 0.0  # MRR contribution per month
    billing_frequency: Optional[str] = None  # Monthly, Bi-Weekly, Custom
    retainer_start_date: Optional[datetime] = None
    retainer_end_date: Optional[datetime] = None  # If set, retainer is churned
    contract_length_months: Optional[int] = None  # None means ongoing/no end
    is_ongoing: bool = False  # True if no end date specified
    
    # Currency (all money values in this currency; conversion_rate converts to base USD)
    currency: str = "USD"
    conversion_rate: float = 1.0  # amount_in_local * conversion_rate = amount_in_USD

    @field_validator('email', mode='before')
    @classmethod
    def empty_email_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

class Lead(LeadBase):
    model_config = ConfigDict(extra="ignore")
    lead_id: str
    date_created: datetime
    earnings: float = 0.0
    projected_contract_value: float = 0.0  # For recurring: monthly * length (or *12 if ongoing)
    total_deal_value_usd: float = 0.0
    deposit_amount_usd: float = 0.0
    cash_collected_usd: float = 0.0
    refund_clawback_amount_usd: float = 0.0
    earnings_usd: float = 0.0
    monthly_retainer_amount_usd: float = 0.0
    projected_contract_value_usd: float = 0.0
    aging_flag: bool = False
    created_by: str

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    lead_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    qualifier_name: Optional[str] = None
    closer_name: Optional[str] = None
    status: Optional[str] = None
    first_contact_datetime: Optional[datetime] = None
    date_discovery_booked: Optional[datetime] = None
    date_of_discovery_call: Optional[datetime] = None
    last_touch_date: Optional[datetime] = None
    discovery_call_status: Optional[str] = None
    proposal_sent: Optional[bool] = None
    close_type: Optional[str] = None
    project_type: Optional[str] = None
    technology_used: Optional[str] = None
    estimated_timeline: Optional[str] = None
    loss_reason: Optional[str] = None
    payment_type: Optional[str] = None
    deposit_amount: Optional[float] = None
    total_deal_value: Optional[float] = None
    cash_collected: Optional[float] = None
    date_paid_in_full: Optional[datetime] = None
    refund_clawback_amount: Optional[float] = None
    commission_percent: Optional[float] = None
    monthly_retainer_amount: Optional[float] = None
    billing_frequency: Optional[str] = None
    retainer_start_date: Optional[datetime] = None
    retainer_end_date: Optional[datetime] = None
    contract_length_months: Optional[int] = None
    is_ongoing: Optional[bool] = None
    currency: Optional[str] = None
    conversion_rate: Optional[float] = None

    @field_validator('email', mode='before')
    @classmethod
    def empty_email_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

class DailyActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    activity_id: str
    qualifier_name: str  # Was setter_name
    date: datetime
    outreach_sent: int = 0  # Was dials_dms_sent
    conversations: int = 0
    created_by: str
    created_at: datetime

class DailyActivityCreate(BaseModel):
    qualifier_name: str
    date: datetime
    outreach_sent: int = 0
    conversations: int = 0

class RevenueGoal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    goal_id: str
    month: str  # YYYY-MM
    goal_amount: float  # One-time goal (kept for backward compat)
    one_time_goal: float = 0.0
    recurring_mrr_goal: float = 0.0
    updated_at: datetime

class RevenueGoalUpdate(BaseModel):
    goal_amount: Optional[float] = None
    one_time_goal: Optional[float] = None
    recurring_mrr_goal: Optional[float] = None

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    html_content: str

# ============= HELPER FUNCTIONS =============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """Extract user from session_token cookie or Authorization header"""
    token = None
    
    # Try Authorization header first
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if it's a session_token (from Google Auth)
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session_doc:
        expires_at = session_doc["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        return User(**user_doc)
    
    # Check if it's a JWT token (from email/password auth)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        return User(**user_doc)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_lead_metrics(lead: dict) -> dict:
    """Calculate auto-generated fields for a lead (handles both One-Time and Recurring)"""
    # Ensure currency defaults
    if not lead.get("currency"):
        lead["currency"] = "USD"
    if not lead.get("conversion_rate") or lead.get("conversion_rate") <= 0:
        lead["conversion_rate"] = 1.0
    if not lead.get("payment_type"):
        lead["payment_type"] = "One-Time"
    
    conversion_rate = lead.get("conversion_rate", 1.0)
    payment_type = lead.get("payment_type", "One-Time")
    
    # Calculate projected_contract_value for recurring
    if payment_type == "Recurring":
        monthly = lead.get("monthly_retainer_amount", 0) or 0
        length = lead.get("contract_length_months", 0) or 0
        is_ongoing = lead.get("is_ongoing", False)
        if is_ongoing or not length:
            lead["projected_contract_value"] = round(monthly * 12, 2)  # Annual projection for ongoing
        else:
            lead["projected_contract_value"] = round(monthly * length, 2)
    else:
        lead["projected_contract_value"] = round(lead.get("total_deal_value", 0), 2)
    
    # Calculate earnings — commission on cash collected (net of refunds) per spec
    # For recurring: earnings is per-cycle collected, not projected
    net_cash = lead.get("cash_collected", 0) - lead.get("refund_clawback_amount", 0)
    earnings = net_cash * (lead.get("commission_percent", 0) / 100)
    lead["earnings"] = round(earnings, 2)
    
    # USD-converted values for aggregation
    lead["total_deal_value_usd"] = round(lead.get("total_deal_value", 0) * conversion_rate, 2)
    lead["deposit_amount_usd"] = round(lead.get("deposit_amount", 0) * conversion_rate, 2)
    lead["cash_collected_usd"] = round(lead.get("cash_collected", 0) * conversion_rate, 2)
    lead["refund_clawback_amount_usd"] = round(lead.get("refund_clawback_amount", 0) * conversion_rate, 2)
    lead["earnings_usd"] = round(earnings * conversion_rate, 2)
    lead["monthly_retainer_amount_usd"] = round(lead.get("monthly_retainer_amount", 0) * conversion_rate, 2)
    lead["projected_contract_value_usd"] = round(lead.get("projected_contract_value", 0) * conversion_rate, 2)
    
    # Calculate aging flag
    aging_flag = False
    if lead.get("status") == "Follow-Up Ongoing" and lead.get("last_touch_date"):
        last_touch = lead["last_touch_date"]
        if isinstance(last_touch, str):
            last_touch = datetime.fromisoformat(last_touch)
        if last_touch.tzinfo is None:
            last_touch = last_touch.replace(tzinfo=timezone.utc)
        days_since_touch = (datetime.now(timezone.utc) - last_touch).days
        if days_since_touch >= 7:
            aging_flag = True
    lead["aging_flag"] = aging_flag
    
    return lead

# ============= AUTH ENDPOINTS =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_password = hash_password(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "password_hash": hashed_password,
        "picture": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Create token
    token = create_access_token({"sub": user_id})
    
    user_doc.pop("password_hash")
    return {"token": token, "user": User(**user_doc)}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    # Find user
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(login_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    token = create_access_token({"sub": user_doc["user_id"]})
    
    user_doc.pop("password_hash")
    user_doc.pop("_id")
    return {"token": token, "user": User(**user_doc)}

@api_router.get("/auth/me", response_model=User)
async def get_me(authorization: Optional[str] = Header(None)):
    return await get_current_user(authorization)

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    # Delete all sessions for this user
    await db.user_sessions.delete_many({"user_id": user.user_id})
    return {"message": "Logged out successfully"}

# ============= LEAD ENDPOINTS =============

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Get all leads
    leads = await db.leads.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate metrics for each lead (mutate in-place so recomputed aging_flag is returned)
    for i, lead in enumerate(leads):
        leads[i] = calculate_lead_metrics(lead)
    
    return leads

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Enforce loss_reason when status is Lost
    if lead_data.status == "Lost" and not lead_data.loss_reason:
        raise HTTPException(status_code=400, detail="Loss reason is required when status is Lost")
    
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    
    lead_doc = lead_data.model_dump()
    lead_doc["lead_id"] = lead_id
    lead_doc["date_created"] = datetime.now(timezone.utc)
    lead_doc["created_by"] = user.user_id
    
    # Calculate metrics
    lead_doc = calculate_lead_metrics(lead_doc)
    
    await db.leads.insert_one(lead_doc)
    
    return Lead(**lead_doc)

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Get existing lead
    existing_lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not existing_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update fields
    update_data = lead_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        existing_lead[key] = value
    
    # Enforce loss_reason when status is Lost
    if existing_lead.get("status") == "Lost" and not existing_lead.get("loss_reason"):
        raise HTTPException(status_code=400, detail="Loss reason is required when status is Lost")
    
    # Recalculate metrics
    existing_lead = calculate_lead_metrics(existing_lead)
    
    await db.leads.update_one({"lead_id": lead_id}, {"$set": existing_lead})
    
    return Lead(**existing_lead)

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    result = await db.leads.delete_one({"lead_id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {"message": "Lead deleted successfully"}

@api_router.post("/leads/bulk-upload")
async def bulk_upload_leads(file: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        contents = await file.read()
        csv_data = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        
        leads_created = 0
        for row in csv_reader:
            lead_id = f"lead_{uuid.uuid4().hex[:12]}"
            
            lead_doc = {
                "lead_id": lead_id,
                "lead_name": row.get("lead_name", ""),
                "company": row.get("company"),
                "email": row.get("email"),
                "phone": row.get("phone"),
                "source": row.get("source"),
                "qualifier_name": row.get("qualifier_name") or row.get("setter_name"),
                "closer_name": row.get("closer_name"),
                "status": row.get("status", "New"),
                "date_created": datetime.now(timezone.utc),
                "created_by": user.user_id,
                "payment_type": row.get("payment_type", "One-Time") or "One-Time",
                "project_type": row.get("project_type") or None,
                "technology_used": row.get("technology_used") or None,
                "estimated_timeline": row.get("estimated_timeline") or None,
                "deposit_amount": float(row.get("deposit_amount", 0) or 0),
                "total_deal_value": float(row.get("total_deal_value", 0) or 0),
                "cash_collected": float(row.get("cash_collected", 0) or 0),
                "refund_clawback_amount": float(row.get("refund_clawback_amount", 0) or 0),
                "commission_percent": float(row.get("commission_percent", 0) or 0),
                "monthly_retainer_amount": float(row.get("monthly_retainer_amount", 0) or 0),
                "billing_frequency": row.get("billing_frequency") or None,
                "contract_length_months": int(row.get("contract_length_months", 0) or 0) or None,
                "is_ongoing": (row.get("is_ongoing", "") or "").lower() == "true",
                "proposal_sent": (row.get("proposal_sent", "") or row.get("offer_made", "") or "").lower() == "true",
                "close_type": row.get("close_type") or None,
                "currency": row.get("currency", "USD") or "USD",
                "conversion_rate": float(row.get("conversion_rate", 1.0) or 1.0),
            }
            
            lead_doc = calculate_lead_metrics(lead_doc)
            await db.leads.insert_one(lead_doc)
            leads_created += 1
        
        return {"message": f"Successfully uploaded {leads_created} leads"}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")

# ============= DAILY ACTIVITY ENDPOINTS =============

@api_router.get("/daily-activities", response_model=List[DailyActivity])
async def get_daily_activities(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    activities = await db.daily_activities.find({}, {"_id": 0}).to_list(1000)
    return activities

@api_router.post("/daily-activities", response_model=DailyActivity)
async def create_daily_activity(activity_data: DailyActivityCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    activity_id = f"activity_{uuid.uuid4().hex[:12]}"
    
    activity_doc = activity_data.model_dump()
    activity_doc["activity_id"] = activity_id
    activity_doc["created_by"] = user.user_id
    activity_doc["created_at"] = datetime.now(timezone.utc)
    
    await db.daily_activities.insert_one(activity_doc)
    
    return DailyActivity(**activity_doc)

# ============= REVENUE GOAL ENDPOINTS =============

@api_router.get("/revenue-goals/{month}", response_model=RevenueGoal)
async def get_revenue_goal(month: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    goal_doc = await db.revenue_goals.find_one({"month": month}, {"_id": 0})
    if not goal_doc:
        goal_id = f"goal_{uuid.uuid4().hex[:12]}"
        goal_doc = {
            "goal_id": goal_id,
            "month": month,
            "goal_amount": 0.0,
            "one_time_goal": 0.0,
            "recurring_mrr_goal": 0.0,
            "updated_at": datetime.now(timezone.utc)
        }
        await db.revenue_goals.insert_one(goal_doc)
    # Ensure fields exist for older docs
    goal_doc.setdefault("one_time_goal", goal_doc.get("goal_amount", 0.0))
    goal_doc.setdefault("recurring_mrr_goal", 0.0)
    return RevenueGoal(**goal_doc)

@api_router.put("/revenue-goals/{month}", response_model=RevenueGoal)
async def update_revenue_goal(month: str, goal_update: RevenueGoalUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    if goal_update.goal_amount is not None:
        update_fields["goal_amount"] = goal_update.goal_amount
    if goal_update.one_time_goal is not None:
        update_fields["one_time_goal"] = goal_update.one_time_goal
    if goal_update.recurring_mrr_goal is not None:
        update_fields["recurring_mrr_goal"] = goal_update.recurring_mrr_goal
    
    goal_doc = await db.revenue_goals.find_one({"month": month}, {"_id": 0})
    if not goal_doc:
        goal_id = f"goal_{uuid.uuid4().hex[:12]}"
        goal_doc = {
            "goal_id": goal_id,
            "month": month,
            "goal_amount": update_fields.get("goal_amount", 0.0),
            "one_time_goal": update_fields.get("one_time_goal", 0.0),
            "recurring_mrr_goal": update_fields.get("recurring_mrr_goal", 0.0),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.revenue_goals.insert_one(goal_doc)
    else:
        await db.revenue_goals.update_one({"month": month}, {"$set": update_fields})
        goal_doc.update(update_fields)
    
    goal_doc.setdefault("one_time_goal", 0.0)
    goal_doc.setdefault("recurring_mrr_goal", 0.0)
    return RevenueGoal(**goal_doc)

# ============= METRICS ENDPOINTS =============

@api_router.get("/metrics/dashboard")
async def get_dashboard_metrics(
    authorization: Optional[str] = Header(None),
    qualifier_filter: Optional[str] = Query(None),
    closer_filter: Optional[str] = Query(None),
    source_filter: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    user = await get_current_user(authorization)
    
    # Build filter
    query_filter = {}
    if qualifier_filter:
        query_filter["qualifier_name"] = qualifier_filter
    if closer_filter:
        query_filter["closer_name"] = closer_filter
    if source_filter:
        query_filter["source"] = source_filter
    if start_date:
        query_filter["date_created"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "date_created" in query_filter:
            query_filter["date_created"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            query_filter["date_created"] = {"$lte": datetime.fromisoformat(end_date)}
    
    # Get all leads with filter
    leads = await db.leads.find(query_filter, {"_id": 0}).to_list(10000)
    
    # Get daily activities (filter by qualifier if set)
    activity_filter = {}
    if qualifier_filter:
        activity_filter["qualifier_name"] = qualifier_filter
    activities = await db.daily_activities.find(activity_filter, {"_id": 0}).to_list(10000)
    
    # ============= Qualifier metrics =============
    total_outreach = sum(a.get("outreach_sent", 0) for a in activities)
    total_conversations = sum(a.get("conversations", 0) for a in activities)
    
    # Speed to lead calculation
    speed_to_lead_minutes = 0
    speed_count = 0
    for lead in leads:
        if lead.get("date_created") and lead.get("first_contact_datetime"):
            dc = lead["date_created"]
            fc = lead["first_contact_datetime"]
            if isinstance(dc, str):
                dc = datetime.fromisoformat(dc)
            if isinstance(fc, str):
                fc = datetime.fromisoformat(fc)
            if dc.tzinfo is None:
                dc = dc.replace(tzinfo=timezone.utc)
            if fc.tzinfo is None:
                fc = fc.replace(tzinfo=timezone.utc)
            diff_minutes = (fc - dc).total_seconds() / 60
            speed_to_lead_minutes += diff_minutes
            speed_count += 1
    
    avg_speed_to_lead = round(speed_to_lead_minutes / speed_count, 2) if speed_count > 0 else 0
    
    # Booking lag calculation (date_discovery_booked -> date_of_discovery_call)
    booking_lag_days = 0
    booking_count = 0
    for lead in leads:
        if lead.get("date_discovery_booked") and lead.get("date_of_discovery_call"):
            dmb = lead["date_discovery_booked"]
            dom = lead["date_of_discovery_call"]
            if isinstance(dmb, str):
                dmb = datetime.fromisoformat(dmb)
            if isinstance(dom, str):
                dom = datetime.fromisoformat(dom)
            if dmb.tzinfo is None:
                dmb = dmb.replace(tzinfo=timezone.utc)
            if dom.tzinfo is None:
                dom = dom.replace(tzinfo=timezone.utc)
            diff_days = (dom - dmb).days
            booking_lag_days += diff_days
            booking_count += 1
    
    avg_booking_lag = round(booking_lag_days / booking_count, 2) if booking_count > 0 else 0
    
    # Discovery call status counts
    calls_scheduled = len([l for l in leads if l.get("date_discovery_booked")])
    calls_taken = len([l for l in leads if l.get("discovery_call_status") == "Show"])
    no_shows = len([l for l in leads if l.get("discovery_call_status") == "No-Show"])
    cancels = len([l for l in leads if l.get("discovery_call_status") == "Cancel"])
    declines = len([l for l in leads if l.get("discovery_call_status") in ["Rescheduled By Them"]])
    dq_count = len([l for l in leads if l.get("discovery_call_status") == "DQ"])
    
    show_up_rate = round((calls_taken / calls_scheduled * 100), 2) if calls_scheduled > 0 else 0
    dq_rate = round((dq_count / calls_scheduled * 100), 2) if calls_scheduled > 0 else 0
    conversations_to_booked_pct = round((calls_scheduled / total_conversations * 100), 2) if total_conversations > 0 else 0
    
    # ============= Closer metrics =============
    proposals_sent = len([l for l in leads if l.get("proposal_sent") == True])
    total_deals_won = len([l for l in leads if l.get("status") == "Won"])
    
    proposal_rate = round((proposals_sent / calls_taken * 100), 2) if calls_taken > 0 else 0
    close_rate = round((total_deals_won / calls_taken * 100), 2) if calls_taken > 0 else 0
    close_rate_on_proposals = round((total_deals_won / proposals_sent * 100), 2) if proposals_sent > 0 else 0
    
    single_call_closes = len([l for l in leads if l.get("close_type") == "Single-Call Close"])
    followup_closes = len([l for l in leads if l.get("close_type") == "Follow-Up Close"])
    
    # Won leads split into One-Time and Recurring
    won_leads = [l for l in leads if l.get("status") == "Won"]
    won_one_time = [l for l in won_leads if l.get("payment_type", "One-Time") == "One-Time"]
    won_recurring = [l for l in won_leads if l.get("payment_type") == "Recurring"]
    
    # Average contract value (mix of one-time TCV and recurring projected)
    def _contract_value_usd(l):
        if l.get("payment_type") == "Recurring":
            return l.get("projected_contract_value_usd", 0) or 0
        return l.get("total_deal_value_usd", 0) or 0
    
    total_won_contract_value = sum(_contract_value_usd(l) for l in won_leads)
    avg_deal_size = round(total_won_contract_value / len(won_leads), 2) if won_leads else 0
    revenue_per_call = round(total_won_contract_value / calls_taken, 2) if calls_taken > 0 else 0
    
    # Loss reasons
    lost_leads = [l for l in leads if l.get("status") == "Lost"]
    loss_reasons = {}
    for lead in lost_leads:
        reason = lead.get("loss_reason", "Unknown")
        loss_reasons[reason] = loss_reasons.get(reason, 0) + 1
    
    # Project Type breakdown for Won deals
    project_type_breakdown = {}
    for lead in won_leads:
        pt = lead.get("project_type") or "Unspecified"
        if pt not in project_type_breakdown:
            project_type_breakdown[pt] = {"count": 0, "revenue_usd": 0}
        project_type_breakdown[pt]["count"] += 1
        project_type_breakdown[pt]["revenue_usd"] += _contract_value_usd(lead)
    
    # Follow-up aging
    followup_aging_count = len([l for l in leads if l.get("aging_flag") == True])
    
    # ============= Money metrics =============
    # One-Time revenue (only one-time won leads for actual revenue)
    one_time_deposits = sum(l.get("deposit_amount_usd", 0) for l in leads if l.get("payment_type", "One-Time") == "One-Time")
    one_time_contracts_signed = sum(l.get("total_deal_value_usd", 0) for l in won_one_time)
    one_time_revenue = one_time_contracts_signed  # signed contract value
    one_time_cash_collected = sum(l.get("cash_collected_usd", 0) for l in leads if l.get("payment_type", "One-Time") == "One-Time")
    
    # Deposit → Paid In Full (one-time)
    deposit_leads = [l for l in leads if l.get("deposit_amount", 0) > 0 and l.get("payment_type", "One-Time") == "One-Time"]
    paid_in_full_leads = [l for l in deposit_leads if l.get("date_paid_in_full")]
    deposit_to_paid_pct = round((len(paid_in_full_leads) / len(deposit_leads) * 100), 2) if deposit_leads else 0
    
    days_to_collect_total = 0
    days_count = 0
    for lead in paid_in_full_leads:
        if lead.get("date_created") and lead.get("date_paid_in_full"):
            dc = lead["date_created"]
            dpif = lead["date_paid_in_full"]
            if isinstance(dc, str):
                dc = datetime.fromisoformat(dc)
            if isinstance(dpif, str):
                dpif = datetime.fromisoformat(dpif)
            if dc.tzinfo is None:
                dc = dc.replace(tzinfo=timezone.utc)
            if dpif.tzinfo is None:
                dpif = dpif.replace(tzinfo=timezone.utc)
            days = (dpif - dc).days
            days_to_collect_total += days
            days_count += 1
    avg_days_to_collect = round(days_to_collect_total / days_count, 2) if days_count > 0 else 0
    
    # Recurring / MRR
    # Active MRR = Won recurring leads that haven't ended
    now_utc = datetime.now(timezone.utc)
    def _is_active_retainer(lead):
        if lead.get("payment_type") != "Recurring" or lead.get("status") != "Won":
            return False
        end_date = lead.get("retainer_end_date")
        if end_date:
            if isinstance(end_date, str):
                end_date = datetime.fromisoformat(end_date)
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            if end_date < now_utc:
                return False
        return True
    
    active_retainers = [l for l in won_recurring if _is_active_retainer(l)]
    churned_retainers = [l for l in won_recurring if not _is_active_retainer(l)]
    total_active_mrr = sum(l.get("monthly_retainer_amount_usd", 0) for l in active_retainers)
    churned_mrr = sum(l.get("monthly_retainer_amount_usd", 0) for l in churned_retainers)
    
    # New MRR added this period (based on retainer_start_date within date filter, or all-time)
    def _in_period(lead_date):
        if not lead_date:
            return True
        if isinstance(lead_date, str):
            lead_date = datetime.fromisoformat(lead_date)
        if lead_date.tzinfo is None:
            lead_date = lead_date.replace(tzinfo=timezone.utc)
        if start_date:
            s = datetime.fromisoformat(start_date)
            if s.tzinfo is None:
                s = s.replace(tzinfo=timezone.utc)
            if lead_date < s:
                return False
        if end_date:
            e = datetime.fromisoformat(end_date)
            if e.tzinfo is None:
                e = e.replace(tzinfo=timezone.utc)
            if lead_date > e:
                return False
        return True
    
    new_mrr_added = sum(l.get("monthly_retainer_amount_usd", 0) for l in won_recurring if _in_period(l.get("retainer_start_date") or l.get("date_created")))
    recurring_cash_collected = sum(l.get("cash_collected_usd", 0) for l in leads if l.get("payment_type") == "Recurring")
    
    # Refunds/Clawbacks (across both types)
    refunds = sum(l.get("refund_clawback_amount_usd", 0) for l in leads)
    net_revenue = (one_time_revenue + total_active_mrr * 12) - refunds  # annualized recurring for a comparable "net revenue" line
    
    # Commission earned (in USD, on cash collected)
    total_commissions = sum(l.get("earnings_usd", 0) for l in leads)
    
    return {
        "qualifier_metrics": {
            "outreach_sent": total_outreach,
            "conversations": total_conversations,
            "conversations_to_booked_pct": conversations_to_booked_pct,
            "speed_to_lead_minutes": avg_speed_to_lead,
            "booking_lag_days": avg_booking_lag,
            "calls_scheduled": calls_scheduled,
            "calls_taken": calls_taken,
            "declines": declines,
            "cancels": cancels,
            "no_shows": no_shows,
            "show_up_rate": show_up_rate,
            "dq_rate": dq_rate
        },
        "closer_metrics": {
            "proposals_sent": proposals_sent,
            "proposal_rate": proposal_rate,
            "close_rate": close_rate,
            "close_rate_on_proposals": close_rate_on_proposals,
            "single_call_closes": single_call_closes,
            "followup_closes": followup_closes,
            "avg_deal_size": avg_deal_size,
            "revenue_per_call": revenue_per_call,
            "loss_reasons": loss_reasons,
            "project_type_breakdown": project_type_breakdown,
            "followup_aging_count": followup_aging_count
        },
        "money_metrics": {
            # One-Time
            "one_time_deposits": one_time_deposits,
            "one_time_contracts_signed": one_time_contracts_signed,
            "one_time_revenue": one_time_revenue,
            "one_time_cash_collected": one_time_cash_collected,
            "deposit_to_paid_pct": deposit_to_paid_pct,
            "avg_days_to_collect": avg_days_to_collect,
            # Recurring / MRR
            "new_mrr_added": new_mrr_added,
            "total_active_mrr": total_active_mrr,
            "retainer_churn_count": len(churned_retainers),
            "churned_mrr": churned_mrr,
            "recurring_cash_collected": recurring_cash_collected,
            # Combined
            "refunds": refunds,
            "net_revenue": net_revenue,
            "total_commissions": total_commissions
        }
    }

@api_router.get("/metrics/projection")
async def get_projection(
    authorization: Optional[str] = Header(None),
    month: Optional[str] = Query(None)
):
    user = await get_current_user(authorization)
    
    # Get current month if not specified
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    # Get leads for projection
    leads = await db.leads.find({}, {"_id": 0}).to_list(10000)
    
    # Calculate historical rates
    calls_taken = len([l for l in leads if l.get("discovery_call_status") == "Show"])
    proposals_sent = len([l for l in leads if l.get("proposal_sent") == True])
    total_won = len([l for l in leads if l.get("status") == "Won"])
    
    show_up_rate = calls_taken / len(leads) if leads else 0.5
    proposal_rate = proposals_sent / calls_taken if calls_taken > 0 else 0.3
    close_rate = total_won / proposals_sent if proposals_sent > 0 else 0.25
    
    won_leads = [l for l in leads if l.get("status") == "Won"]
    won_one_time = [l for l in won_leads if l.get("payment_type", "One-Time") == "One-Time"]
    won_recurring = [l for l in won_leads if l.get("payment_type") == "Recurring"]
    
    avg_one_time_deal_size = (
        sum(l.get("total_deal_value_usd", 0) for l in won_one_time) / len(won_one_time)
        if won_one_time else 5000
    )
    avg_mrr_deal = (
        sum(l.get("monthly_retainer_amount_usd", 0) for l in won_recurring) / len(won_recurring)
        if won_recurring else 1000
    )
    
    # Ratio of one-time vs recurring wins historically
    total_won_count = len(won_leads) or 1
    one_time_ratio = len(won_one_time) / total_won_count if won_leads else 0.7
    recurring_ratio = len(won_recurring) / total_won_count if won_leads else 0.3
    
    # Get scheduled discovery calls for this month
    month_start = datetime.fromisoformat(f"{month}-01").replace(tzinfo=timezone.utc)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)
    
    def _get_dt(v):
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v
    
    scheduled_calls = len([
        l for l in leads 
        if l.get("date_discovery_booked") and 
        month_start <= _get_dt(l["date_discovery_booked"]) < month_end
    ])
    
    # Calculate expected wins
    expected_shows = scheduled_calls * show_up_rate
    expected_proposals = expected_shows * proposal_rate
    expected_wins = expected_proposals * close_rate
    
    # Split wins by historical mix
    expected_one_time_wins = expected_wins * one_time_ratio
    expected_recurring_wins = expected_wins * recurring_ratio
    
    # One-Time revenue projection
    expected_one_time_revenue = expected_one_time_wins * avg_one_time_deal_size
    best_one_time = expected_one_time_revenue * 1.3
    worst_one_time = expected_one_time_revenue * 0.7
    
    # New MRR projection
    expected_new_mrr = expected_recurring_wins * avg_mrr_deal
    best_new_mrr = expected_new_mrr * 1.3
    worst_new_mrr = expected_new_mrr * 0.7
    
    # Current Active MRR (running line)
    now_utc = datetime.now(timezone.utc)
    def _is_active(lead):
        if lead.get("payment_type") != "Recurring" or lead.get("status") != "Won":
            return False
        end_date = lead.get("retainer_end_date")
        if end_date:
            end_date = _get_dt(end_date)
            if end_date < now_utc:
                return False
        return True
    
    current_active_mrr = sum(l.get("monthly_retainer_amount_usd", 0) for l in won_recurring if _is_active(l))
    projected_total_mrr_end_of_month = current_active_mrr + expected_new_mrr
    
    return {
        "month": month,
        "scheduled_calls": scheduled_calls,
        "show_up_rate": round(show_up_rate * 100, 2),
        "proposal_rate": round(proposal_rate * 100, 2),
        "close_rate": round(close_rate * 100, 2),
        "avg_one_time_deal_size": round(avg_one_time_deal_size, 2),
        "avg_mrr_deal_size": round(avg_mrr_deal, 2),
        "one_time_projection": {
            "best_case": round(best_one_time, 2),
            "expected_case": round(expected_one_time_revenue, 2),
            "worst_case": round(worst_one_time, 2)
        },
        "mrr_projection": {
            "best_case_new_mrr": round(best_new_mrr, 2),
            "expected_new_mrr": round(expected_new_mrr, 2),
            "worst_case_new_mrr": round(worst_new_mrr, 2),
            "current_active_mrr": round(current_active_mrr, 2),
            "projected_total_mrr_end_of_month": round(projected_total_mrr_end_of_month, 2)
        }
    }

# ============= EMAIL ENDPOINTS =============

@api_router.post("/email/send")
async def send_email(request: EmailRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    params = {
        "from": SENDER_EMAIL,
        "to": [request.recipient_email],
        "subject": request.subject,
        "html": request.html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {
            "status": "success",
            "message": f"Email sent to {request.recipient_email}",
            "email_id": email.get("id")
        }
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# ============= ADMIN SEED ENDPOINT =============

@api_router.post("/admin/seed")
async def seed_admin():
    """Create default admin, setter, and closer accounts if they don't exist"""
    accounts = [
        {"email": "admin@salestracker.com", "name": "Admin User", "role": "Admin", "password": "Admin@123"},
        {"email": "setter@salestracker.com", "name": "Setter User", "role": "Setter", "password": "Setter@123"},
        {"email": "closer@salestracker.com", "name": "Closer User", "role": "Closer", "password": "Closer@123"},
    ]
    
    created = []
    for account in accounts:
        existing = await db.users.find_one({"email": account["email"]}, {"_id": 0})
        if not existing:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            hashed_password = hash_password(account["password"])
            
            user_doc = {
                "user_id": user_id,
                "email": account["email"],
                "name": account["name"],
                "role": account["role"],
                "password_hash": hashed_password,
                "picture": None,
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.users.insert_one(user_doc)
            created.append(account["email"])
    
    return {"message": "Seed completed", "created": created}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
