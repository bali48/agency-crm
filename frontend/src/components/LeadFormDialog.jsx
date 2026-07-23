import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { CURRENCIES, DEFAULT_RATES } from '@/lib/currencies';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUSES = ['New', 'Discovery Call Booked', 'Proposal/SOW Sent', 'Contract Sent', 'Deposit Paid', 'Follow-Up Ongoing', 'Won', 'Lost'];
const DISCOVERY_STATUSES = ['Show', 'No-Show', 'Rescheduled By Us', 'Rescheduled By Them', 'Cancel', 'DQ'];
const LOSS_REASONS = ['Budget', 'Timeline', 'Went In-House', 'Chose Competitor', 'Ghosted', 'Not Qualified'];
const CLOSE_TYPES = ['Single-Call Close', 'Follow-Up Close'];
const SOURCES = ['Referral', 'Inbound', 'Outbound', 'Upwork/Toptal/etc.', 'Partner', 'Other'];
const PROJECT_TYPES = ['Fixed-Scope Build', 'Retainer', 'Staff Augmentation', 'Ongoing Support'];
const BILLING_FREQUENCIES = ['Monthly', 'Bi-Weekly', 'Custom'];

const toDateInput = (dateStr) => (dateStr ? new Date(dateStr).toISOString().split('T')[0] : '');
const toDateTimeInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
};

const LeadFormDialog = ({ isOpen, onClose, onSuccess, lead }) => {
  const isEdit = !!lead;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lead_name: '',
    company: '',
    email: '',
    phone: '',
    source: '',
    qualifier_name: '',
    closer_name: '',
    status: 'New',
    first_contact_datetime: '',
    date_discovery_booked: '',
    date_of_discovery_call: '',
    last_touch_date: '',
    discovery_call_status: '',
    proposal_sent: false,
    close_type: '',
    project_type: '',
    technology_used: '',
    estimated_timeline: '',
    loss_reason: '',
    payment_type: 'One-Time',
    // One-time
    deposit_amount: 0,
    total_deal_value: 0,
    cash_collected: 0,
    date_paid_in_full: '',
    refund_clawback_amount: 0,
    commission_percent: 0,
    // Recurring
    monthly_retainer_amount: 0,
    billing_frequency: '',
    retainer_start_date: '',
    retainer_end_date: '',
    contract_length_months: '',
    is_ongoing: false,
    // Currency
    currency: 'USD',
    conversion_rate: 1.0
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        lead_name: lead.lead_name || '',
        company: lead.company || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || '',
        qualifier_name: lead.qualifier_name || '',
        closer_name: lead.closer_name || '',
        status: lead.status || 'New',
        first_contact_datetime: toDateTimeInput(lead.first_contact_datetime),
        date_discovery_booked: toDateTimeInput(lead.date_discovery_booked),
        date_of_discovery_call: toDateTimeInput(lead.date_of_discovery_call),
        last_touch_date: toDateInput(lead.last_touch_date),
        discovery_call_status: lead.discovery_call_status || '',
        proposal_sent: lead.proposal_sent || false,
        close_type: lead.close_type || '',
        project_type: lead.project_type || '',
        technology_used: lead.technology_used || '',
        estimated_timeline: lead.estimated_timeline || '',
        loss_reason: lead.loss_reason || '',
        payment_type: lead.payment_type || 'One-Time',
        deposit_amount: lead.deposit_amount || 0,
        total_deal_value: lead.total_deal_value || 0,
        cash_collected: lead.cash_collected || 0,
        date_paid_in_full: toDateInput(lead.date_paid_in_full),
        refund_clawback_amount: lead.refund_clawback_amount || 0,
        commission_percent: lead.commission_percent || 0,
        monthly_retainer_amount: lead.monthly_retainer_amount || 0,
        billing_frequency: lead.billing_frequency || '',
        retainer_start_date: toDateInput(lead.retainer_start_date),
        retainer_end_date: toDateInput(lead.retainer_end_date),
        contract_length_months: lead.contract_length_months || '',
        is_ongoing: lead.is_ongoing || false,
        currency: lead.currency || 'USD',
        conversion_rate: lead.conversion_rate || 1.0
      });
    }
  }, [lead]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'currency' && DEFAULT_RATES[value] !== undefined) {
        updated.conversion_rate = DEFAULT_RATES[value];
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!formData.lead_name) {
      toast.error('Lead name is required');
      return;
    }
    if (formData.status === 'Lost' && !formData.loss_reason) {
      toast.error('Loss reason is required when status is Lost');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { ...formData };
      
      ['first_contact_datetime', 'date_discovery_booked', 'date_of_discovery_call', 'last_touch_date', 'date_paid_in_full', 'retainer_start_date', 'retainer_end_date'].forEach(field => {
        if (payload[field] === '') payload[field] = null;
        else if (payload[field]) payload[field] = new Date(payload[field]).toISOString();
      });
      
      ['discovery_call_status', 'close_type', 'loss_reason', 'source', 'project_type', 'billing_frequency', 'technology_used', 'estimated_timeline'].forEach(field => {
        if (payload[field] === '') payload[field] = null;
      });

      ['deposit_amount', 'total_deal_value', 'cash_collected', 'refund_clawback_amount', 'commission_percent', 'monthly_retainer_amount', 'conversion_rate'].forEach(field => {
        payload[field] = parseFloat(payload[field]) || 0;
      });
      payload.contract_length_months = payload.contract_length_months === '' ? null : parseInt(payload.contract_length_months) || null;
      if (!payload.conversion_rate || payload.conversion_rate <= 0) payload.conversion_rate = 1.0;
      if (!payload.currency) payload.currency = 'USD';

      if (isEdit) {
        await axios.put(`${API}/leads/${lead.lead_id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Lead updated');
      } else {
        await axios.post(`${API}/leads`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Lead created');
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/leads/${lead.lead_id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Lead deleted');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to delete lead');
    } finally {
      setLoading(false);
    }
  };

  const isRecurring = formData.payment_type === 'Recurring';
  const projectedContractValue = isRecurring
    ? (parseFloat(formData.monthly_retainer_amount) || 0) * (formData.is_ongoing || !formData.contract_length_months ? 12 : parseInt(formData.contract_length_months))
    : parseFloat(formData.total_deal_value) || 0;
  const earnings = isRecurring
    ? ((parseFloat(formData.cash_collected) || 0) - (parseFloat(formData.refund_clawback_amount) || 0)) * ((parseFloat(formData.commission_percent) || 0) / 100)
    : ((parseFloat(formData.cash_collected) || 0) - (parseFloat(formData.refund_clawback_amount) || 0)) * ((parseFloat(formData.commission_percent) || 0) / 100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white" data-testid="lead-form-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {isEdit ? 'Edit Lead' : 'New Lead'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="discovery">Discovery</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="outcome">Outcome</TabsTrigger>
            <TabsTrigger value="money">Money</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lead Name *</Label>
                <Input data-testid="lead-name-input" value={formData.lead_name} onChange={(e) => handleChange('lead_name', e.target.value)} />
              </div>
              <div>
                <Label>Company</Label>
                <Input data-testid="lead-company-input" value={formData.company} onChange={(e) => handleChange('company', e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input data-testid="lead-email-input" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input data-testid="lead-phone-input" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
              </div>
              <div>
                <Label>Source</Label>
                <Select value={formData.source} onValueChange={(v) => handleChange('source', v)}>
                  <SelectTrigger data-testid="lead-source-select"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger data-testid="lead-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qualifier Name</Label>
                <Input data-testid="lead-qualifier-input" value={formData.qualifier_name} onChange={(e) => handleChange('qualifier_name', e.target.value)} />
              </div>
              <div>
                <Label>Closer Name</Label>
                <Input data-testid="lead-closer-input" value={formData.closer_name} onChange={(e) => handleChange('closer_name', e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="discovery" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Contact Date/Time</Label>
                <Input type="datetime-local" value={formData.first_contact_datetime} onChange={(e) => handleChange('first_contact_datetime', e.target.value)} />
              </div>
              <div>
                <Label>Date Discovery Call Booked</Label>
                <Input type="datetime-local" value={formData.date_discovery_booked} onChange={(e) => handleChange('date_discovery_booked', e.target.value)} />
              </div>
              <div>
                <Label>Date of Discovery Call</Label>
                <Input type="datetime-local" value={formData.date_of_discovery_call} onChange={(e) => handleChange('date_of_discovery_call', e.target.value)} />
              </div>
              <div>
                <Label>Last Touch Date</Label>
                <Input type="date" value={formData.last_touch_date} onChange={(e) => handleChange('last_touch_date', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Discovery Call Status</Label>
                <Select value={formData.discovery_call_status} onValueChange={(v) => handleChange('discovery_call_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select call status" /></SelectTrigger>
                  <SelectContent>
                    {DISCOVERY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scope" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Project Type</Label>
                <Select value={formData.project_type} onValueChange={(v) => handleChange('project_type', v)}>
                  <SelectTrigger data-testid="project-type-select"><SelectValue placeholder="Select project type" /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estimated Timeline</Label>
                <Input placeholder="e.g. 3 months, 6 weeks" value={formData.estimated_timeline} onChange={(e) => handleChange('estimated_timeline', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Technology Used</Label>
                <Input placeholder="e.g. React, Node.js, AWS" value={formData.technology_used} onChange={(e) => handleChange('technology_used', e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="outcome" className="space-y-4">
            <div className="flex items-center gap-3 py-2">
              <Switch checked={formData.proposal_sent} onCheckedChange={(v) => handleChange('proposal_sent', v)} data-testid="proposal-sent-switch" />
              <Label>Proposal Sent</Label>
            </div>
            {formData.proposal_sent && (
              <div>
                <Label>Close Type</Label>
                <Select value={formData.close_type} onValueChange={(v) => handleChange('close_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select close type" /></SelectTrigger>
                  <SelectContent>
                    {CLOSE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.status === 'Lost' && (
              <div>
                <Label>Loss Reason * (required)</Label>
                <Select value={formData.loss_reason} onValueChange={(v) => handleChange('loss_reason', v)}>
                  <SelectTrigger data-testid="loss-reason-select"><SelectValue placeholder="Select loss reason" /></SelectTrigger>
                  <SelectContent>
                    {LOSS_REASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="money" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Currency</Label>
                <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
                  <SelectTrigger data-testid="lead-currency-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conversion Rate (1 {formData.currency} = ? USD)</Label>
                <Input data-testid="lead-conversion-rate-input" type="number" step="0.0001" value={formData.conversion_rate} onChange={(e) => handleChange('conversion_rate', e.target.value)} />
              </div>
              <div className="col-span-2 flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                <Label className="text-sm font-medium">Payment Type:</Label>
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.payment_type === 'One-Time' ? 'default' : 'outline'}
                    onClick={() => handleChange('payment_type', 'One-Time')}
                    className={formData.payment_type === 'One-Time' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
                    data-testid="payment-type-onetime"
                  >
                    One-Time
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.payment_type === 'Recurring' ? 'default' : 'outline'}
                    onClick={() => handleChange('payment_type', 'Recurring')}
                    className={formData.payment_type === 'Recurring' ? 'bg-primary hover:bg-primary-hover text-white' : ''}
                    data-testid="payment-type-recurring"
                  >
                    Recurring
                  </Button>
                </div>
              </div>

              {!isRecurring ? (
                <>
                  <div>
                    <Label>Deposit Amount ({formData.currency})</Label>
                    <Input data-testid="deposit-amount-input" type="number" value={formData.deposit_amount} onChange={(e) => handleChange('deposit_amount', e.target.value)} />
                  </div>
                  <div>
                    <Label>Total Contract Value ({formData.currency})</Label>
                    <Input data-testid="total-deal-value-input" type="number" value={formData.total_deal_value} onChange={(e) => handleChange('total_deal_value', e.target.value)} />
                  </div>
                  <div>
                    <Label>Cash Collected ({formData.currency})</Label>
                    <Input type="number" value={formData.cash_collected} onChange={(e) => handleChange('cash_collected', e.target.value)} />
                  </div>
                  <div>
                    <Label>Date Paid In Full</Label>
                    <Input type="date" value={formData.date_paid_in_full} onChange={(e) => handleChange('date_paid_in_full', e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Monthly / Retainer Amount ({formData.currency})</Label>
                    <Input data-testid="monthly-retainer-input" type="number" value={formData.monthly_retainer_amount} onChange={(e) => handleChange('monthly_retainer_amount', e.target.value)} />
                  </div>
                  <div>
                    <Label>Billing Frequency</Label>
                    <Select value={formData.billing_frequency} onValueChange={(v) => handleChange('billing_frequency', v)}>
                      <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                      <SelectContent>
                        {BILLING_FREQUENCIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Retainer Start Date</Label>
                    <Input type="date" value={formData.retainer_start_date} onChange={(e) => handleChange('retainer_start_date', e.target.value)} />
                  </div>
                  <div>
                    <Label>Retainer End Date (churn)</Label>
                    <Input type="date" value={formData.retainer_end_date} onChange={(e) => handleChange('retainer_end_date', e.target.value)} />
                  </div>
                  <div>
                    <Label>Contract Length (months)</Label>
                    <Input type="number" placeholder="e.g. 6" value={formData.contract_length_months} onChange={(e) => handleChange('contract_length_months', e.target.value)} disabled={formData.is_ongoing} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.is_ongoing} onCheckedChange={(v) => handleChange('is_ongoing', v)} data-testid="is-ongoing-switch" />
                    <Label>Ongoing / No End Date</Label>
                  </div>
                  <div>
                    <Label>Cash Collected To Date ({formData.currency})</Label>
                    <Input type="number" value={formData.cash_collected} onChange={(e) => handleChange('cash_collected', e.target.value)} />
                  </div>
                </>
              )}

              <div>
                <Label>Refund/Clawback Amount ({formData.currency})</Label>
                <Input type="number" value={formData.refund_clawback_amount} onChange={(e) => handleChange('refund_clawback_amount', e.target.value)} />
              </div>
              <div>
                <Label>Commission %</Label>
                <Input data-testid="commission-percent-input" type="number" value={formData.commission_percent} onChange={(e) => handleChange('commission_percent', e.target.value)} />
              </div>

              <div className="col-span-2 p-4 bg-success-bg rounded-lg border border-success/20 space-y-2">
                {isRecurring && (
                  <div>
                    <Label className="text-success">Projected Contract Value {formData.is_ongoing ? '(annualized)' : ''}</Label>
                    <p className="text-xl font-bold text-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {formData.currency} {projectedContractValue.toFixed(2)}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-success">Earnings (on cash collected)</Label>
                  <p className="text-xl font-bold text-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formData.currency} {earnings.toFixed(2)}
                  </p>
                  {formData.currency !== 'USD' && (
                    <p className="text-xs text-muted-foreground">≈ ${(earnings * formData.conversion_rate).toFixed(2)} USD</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between gap-2">
          {isEdit && (
            <Button variant="outline" onClick={handleDelete} disabled={loading} className="border-destructive text-destructive hover:bg-destructive-bg" data-testid="delete-lead-button">
              <Trash2 size={16} strokeWidth={2} className="mr-2" />
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary-hover text-white" data-testid="save-lead-button">
              {loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadFormDialog;
