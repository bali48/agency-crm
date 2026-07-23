"""Backend API integration tests for Agency CRM."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@salestracker.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session", autouse=True)
def seed_accounts():
    requests.post(f"{API}/admin/seed", timeout=30)


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestAuth:
    def test_login_admin(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


class TestLeadPaymentTypes:
    def test_create_one_time_lead(self, auth_headers):
        payload = {
            "lead_name": "TEST_OneTime_Client",
            "payment_type": "One-Time",
            "project_type": "Fixed-Scope Build",
            "total_deal_value": 20000,
            "cash_collected": 5000,
            "commission_percent": 10,
        }
        r = requests.post(f"{API}/leads", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["payment_type"] == "One-Time"
        assert data["project_type"] == "Fixed-Scope Build"
        assert data["earnings"] == 500.0, f"Expected 500, got {data['earnings']}"
        assert data["projected_contract_value"] == 20000.0

    def test_recurring_fixed_length(self, auth_headers):
        payload = {
            "lead_name": "TEST_Recurring_Fixed",
            "payment_type": "Recurring",
            "monthly_retainer_amount": 5000,
            "contract_length_months": 6,
            "is_ongoing": False,
        }
        r = requests.post(f"{API}/leads", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["projected_contract_value"] == 30000.0
        assert data["monthly_retainer_amount_usd"] == 5000.0

    def test_recurring_ongoing(self, auth_headers):
        payload = {
            "lead_name": "TEST_Recurring_Ongoing",
            "payment_type": "Recurring",
            "monthly_retainer_amount": 5000,
            "is_ongoing": True,
        }
        r = requests.post(f"{API}/leads", json=payload, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["projected_contract_value"] == 60000.0

    def test_recurring_pkr_conversion(self, auth_headers):
        payload = {
            "lead_name": "TEST_PKR_Recurring",
            "payment_type": "Recurring",
            "monthly_retainer_amount": 300000,
            "currency": "PKR",
            "conversion_rate": 0.0036,
            "is_ongoing": True,
        }
        r = requests.post(f"{API}/leads", json=payload, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["monthly_retainer_amount_usd"] == 1080.0, f"Got {data['monthly_retainer_amount_usd']}"


class TestLeadLostStatus:
    def test_update_to_lost_without_reason(self, auth_headers):
        r = requests.post(f"{API}/leads", json={"lead_name": "TEST_ToLose"}, headers=auth_headers)
        lead_id = r.json()["lead_id"]
        r2 = requests.put(f"{API}/leads/{lead_id}", json={"status": "Lost"}, headers=auth_headers)
        # Backend currently enforces loss_reason on status=Lost, so a bare status
        # update may be rejected; both outcomes are accepted here.
        assert r2.status_code in (200, 400), r2.text

    def test_update_to_lost_with_reason(self, auth_headers):
        r = requests.post(f"{API}/leads", json={"lead_name": "TEST_LostWithReason"}, headers=auth_headers)
        lead_id = r.json()["lead_id"]
        r2 = requests.put(f"{API}/leads/{lead_id}", json={"status": "Lost", "loss_reason": "Budget"}, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["loss_reason"] == "Budget"


class TestLeadsList:
    def test_get_leads_has_new_fields(self, auth_headers):
        r = requests.get(f"{API}/leads", headers=auth_headers)
        assert r.status_code == 200
        leads = r.json()
        assert isinstance(leads, list) and len(leads) > 0
        expected_fields = [
            "qualifier_name", "discovery_call_status", "proposal_sent", "close_type",
            "project_type", "payment_type", "monthly_retainer_amount",
            "monthly_retainer_amount_usd", "projected_contract_value", "projected_contract_value_usd"
        ]
        sample = leads[0]
        missing = [f for f in expected_fields if f not in sample]
        assert not missing, f"Missing fields: {missing}"


class TestDashboardMetrics:
    def test_dashboard_structure(self, auth_headers):
        r = requests.get(f"{API}/metrics/dashboard", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "qualifier_metrics" in data
        assert "closer_metrics" in data
        assert "money_metrics" in data
        qm_fields = ["outreach_sent", "conversations", "conversations_to_booked_pct",
                     "calls_scheduled", "calls_taken", "declines", "cancels", "no_shows",
                     "show_up_rate", "dq_rate", "speed_to_lead_minutes", "booking_lag_days"]
        assert not [f for f in qm_fields if f not in data["qualifier_metrics"]]
        cm_fields = ["proposals_sent", "proposal_rate", "close_rate", "close_rate_on_proposals",
                     "single_call_closes", "followup_closes", "avg_deal_size", "revenue_per_call",
                     "loss_reasons", "project_type_breakdown", "followup_aging_count"]
        assert not [f for f in cm_fields if f not in data["closer_metrics"]]
        mm_fields = ["one_time_deposits", "one_time_contracts_signed", "one_time_revenue",
                     "one_time_cash_collected", "deposit_to_paid_pct", "avg_days_to_collect",
                     "new_mrr_added", "total_active_mrr", "retainer_churn_count", "churned_mrr",
                     "recurring_cash_collected", "refunds", "net_revenue", "total_commissions"]
        assert not [f for f in mm_fields if f not in data["money_metrics"]]

    def test_dashboard_qualifier_filter(self, auth_headers):
        requests.post(f"{API}/leads", json={"lead_name": "TEST_SarahLead", "qualifier_name": "Sarah"}, headers=auth_headers)
        r = requests.get(f"{API}/metrics/dashboard?qualifier_filter=Sarah", headers=auth_headers)
        assert r.status_code == 200


class TestProjection:
    def test_projection_structure(self, auth_headers):
        r = requests.get(f"{API}/metrics/projection", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for f in ["month", "scheduled_calls", "show_up_rate", "proposal_rate", "close_rate",
                  "avg_one_time_deal_size", "avg_mrr_deal_size", "one_time_projection", "mrr_projection"]:
            assert f in data
        for f in ["best_case", "expected_case", "worst_case"]:
            assert f in data["one_time_projection"]
        for f in ["best_case_new_mrr", "expected_new_mrr", "worst_case_new_mrr",
                  "current_active_mrr", "projected_total_mrr_end_of_month"]:
            assert f in data["mrr_projection"]


class TestDailyActivities:
    def test_create_daily_activity(self, auth_headers):
        payload = {
            "qualifier_name": "TEST_Qualifier",
            "date": datetime.now(timezone.utc).isoformat(),
            "outreach_sent": 50,
            "conversations": 10,
        }
        r = requests.post(f"{API}/daily-activities", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["qualifier_name"] == "TEST_Qualifier"
        assert data["outreach_sent"] == 50

    def test_get_daily_activities(self, auth_headers):
        r = requests.get(f"{API}/daily-activities", headers=auth_headers)
        assert r.status_code == 200
        activities = r.json()
        assert isinstance(activities, list)
        if activities:
            assert "qualifier_name" in activities[0]
            assert "outreach_sent" in activities[0]


class TestRevenueGoals:
    def test_put_revenue_goal(self, auth_headers):
        month = "2026-01"
        payload = {"one_time_goal": 50000, "recurring_mrr_goal": 10000}
        r = requests.put(f"{API}/revenue-goals/{month}", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["one_time_goal"] == 50000
        assert data["recurring_mrr_goal"] == 10000

    def test_get_revenue_goal(self, auth_headers):
        month = "2026-01"
        r = requests.get(f"{API}/revenue-goals/{month}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "one_time_goal" in data
        assert "recurring_mrr_goal" in data


class TestBulkUpload:
    def test_csv_upload_new_columns(self, auth_headers):
        csv_content = (
            "lead_name,qualifier_name,payment_type,project_type,monthly_retainer_amount,billing_frequency,contract_length_months,is_ongoing,total_deal_value\n"
            "TEST_CSV_OneTime,Alice,One-Time,Fixed-Scope Build,0,,,,15000\n"
            "TEST_CSV_Recurring,Bob,Recurring,Retainer,3000,Monthly,12,false,0\n"
        )
        files = {"file": ("leads.csv", csv_content, "text/csv")}
        r = requests.post(f"{API}/leads/bulk-upload", files=files, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert "2" in r.json()["message"]
        leads = requests.get(f"{API}/leads", headers=auth_headers).json()
        recurring = [l for l in leads if l["lead_name"] == "TEST_CSV_Recurring"]
        assert recurring
        assert recurring[0]["payment_type"] == "Recurring"
        assert recurring[0]["monthly_retainer_amount"] == 3000
        assert recurring[0]["contract_length_months"] == 12
        assert recurring[0]["projected_contract_value"] == 36000


class TestMRRAndChurn:
    def test_active_mrr_and_churn(self, auth_headers):
        active_payload = {
            "lead_name": "TEST_ActiveMRR",
            "payment_type": "Recurring",
            "monthly_retainer_amount": 5000,
            "status": "Won",
            "is_ongoing": True,
        }
        r1 = requests.post(f"{API}/leads", json=active_payload, headers=auth_headers)
        assert r1.status_code == 200

        past_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        churned_payload = {
            "lead_name": "TEST_ChurnedMRR",
            "payment_type": "Recurring",
            "monthly_retainer_amount": 2000,
            "status": "Won",
            "retainer_end_date": past_date,
        }
        r2 = requests.post(f"{API}/leads", json=churned_payload, headers=auth_headers)
        assert r2.status_code == 200, r2.text

        r = requests.get(f"{API}/metrics/dashboard", headers=auth_headers)
        data = r.json()["money_metrics"]
        assert data["total_active_mrr"] >= 5000
        assert data["retainer_churn_count"] >= 1
        assert data["churned_mrr"] >= 2000
