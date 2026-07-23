import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Upload, AlertCircle, Mail, Phone, DollarSign, Calendar, User } from 'lucide-react';
import LeadFormDialog from '@/components/LeadFormDialog';
import CSVUploadDialog from '@/components/CSVUploadDialog';
import { formatCurrency, formatUSD } from '@/lib/currencies';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLUMNS = [
  { id: 'New', title: 'New', color: '#635BFF' },
  { id: 'Discovery Call Booked', title: 'Discovery Call Booked', color: '#7C3AED' },
  { id: 'Proposal/SOW Sent', title: 'Proposal / SOW Sent', color: '#00D4FF' },
  { id: 'Contract Sent', title: 'Contract Sent', color: '#0891B2' },
  { id: 'Deposit Paid', title: 'Deposit Paid', color: '#F79009' },
  { id: 'Follow-Up Ongoing', title: 'Follow-Up Ongoing', color: '#FB8500' },
  { id: 'Won', title: 'Won', color: '#0D9068' },
  { id: 'Lost', title: 'Lost', color: '#D92D20' }
];

const formatMoney = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
};

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
};

const KanbanCard = ({ lead, onEdit }) => {
  const currency = lead.currency || 'USD';
  const isDepositUnpaid = lead.deposit_amount > 0 && !lead.date_paid_in_full && daysSince(lead.date_created) >= 14;
  const isBookingLagHigh = lead.date_discovery_booked && lead.date_of_discovery_call &&
    Math.floor((new Date(lead.date_of_discovery_call) - new Date(lead.date_discovery_booked)) / (1000 * 60 * 60 * 24)) > 4;
  const hasAlert = lead.aging_flag || isDepositUnpaid || isBookingLagHigh;

  return (
    <div
      onClick={() => onEdit(lead)}
      data-testid={`kanban-card-${lead.lead_id}`}
      className={`bg-white rounded-xl p-4 mb-3 cursor-pointer border transition-shadow duration-200 hover:shadow-[0_8px_16px_rgba(10,37,64,0.06),0_0_1px_rgba(10,37,64,0.08)] ${hasAlert ? 'border-destructive bg-destructive-bg' : 'border-border'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-foreground text-sm leading-tight">{lead.lead_name}</h4>
        {hasAlert && <AlertCircle size={14} className="text-destructive flex-shrink-0 ml-2" strokeWidth={2} />}
      </div>

      {lead.company && (
        <p className="text-xs text-muted-foreground mb-3">{lead.company}</p>
      )}

      <div className="space-y-1.5 mb-3">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-secondary-text">
            <Mail size={12} strokeWidth={2} />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-secondary-text">
            <Phone size={12} strokeWidth={2} />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.date_of_discovery_call && (
          <div className="flex items-center gap-1.5 text-xs text-secondary-text">
            <Calendar size={12} strokeWidth={2} />
            <span>{new Date(lead.date_of_discovery_call).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {(lead.total_deal_value > 0 || lead.deposit_amount > 0 || lead.monthly_retainer_amount > 0) && (
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          {lead.payment_type === 'Recurring' ? (
            <div className="flex items-center gap-1 text-primary font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {formatCurrency(lead.monthly_retainer_amount, currency)}/mo
              {currency !== 'USD' && (
                <span className="text-muted-foreground text-[10px] ml-1">≈ {formatUSD(lead.monthly_retainer_amount_usd)}/mo</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-success font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {formatCurrency(lead.total_deal_value, currency)}
              {currency !== 'USD' && (
                <span className="text-muted-foreground text-[10px] ml-1">≈ {formatUSD(lead.total_deal_value_usd)}</span>
              )}
            </div>
          )}
          {lead.payment_type !== 'Recurring' && lead.deposit_amount > 0 && (
            <span className="text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              Dep: {formatCurrency(lead.deposit_amount, currency)}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mt-2">
        {lead.payment_type === 'Recurring' && (
          <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary">
            Recurring
          </Badge>
        )}
        {lead.project_type && (
          <Badge variant="outline" className="text-xs bg-background border-border text-secondary-text">
            {lead.project_type}
          </Badge>
        )}
        {lead.qualifier_name && (
          <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
            Q: {lead.qualifier_name}
          </Badge>
        )}
        {lead.closer_name && (
          <Badge variant="outline" className="text-xs bg-accent/10 border-accent/30 text-foreground">
            C: {lead.closer_name}
          </Badge>
        )}
      </div>

      {lead.aging_flag && (
        <div className="mt-2 text-xs text-destructive font-medium flex items-center gap-1">
          <AlertCircle size={12} strokeWidth={2} />
          Aging 7+ days
        </div>
      )}
    </div>
  );
};

const KanbanBoard = ({ leads, onUpdate, user }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/leads/${draggableId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Lead moved to ${newStatus}`);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update lead');
    }
  };

  const handleEdit = (lead) => {
    setSelectedLead(lead);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedLead(null);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setSelectedLead(null);
  };

  const getLeadsForColumn = (columnId) => {
    return leads.filter(lead => lead.status === columnId);
  };

  const getColumnValue = (columnId) => {
    const columnLeads = getLeadsForColumn(columnId);
    return columnLeads.reduce((sum, lead) => {
      const val = lead.payment_type === 'Recurring'
        ? (lead.projected_contract_value_usd || 0)
        : (lead.total_deal_value_usd || lead.total_deal_value || 0);
      return sum + val;
    }, 0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Kanban Board
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Drag cards between columns to update status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCSVOpen(true)} data-testid="csv-upload-button" className="border-border">
            <Upload size={16} strokeWidth={2} className="mr-2" />
            CSV Upload
          </Button>
          <Button onClick={handleAddNew} data-testid="add-lead-button" className="bg-primary hover:bg-primary-hover text-white">
            <Plus size={16} strokeWidth={2} className="mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(column => (
            <div key={column.id} className="flex-shrink-0 w-80">
              <div className="bg-background rounded-xl p-3 border border-border">
                <div className="flex items-center justify-between mb-3 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }}></div>
                    <h3 className="font-semibold text-sm text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {column.title}
                    </h3>
                    <Badge variant="outline" className="text-xs bg-white border-border">
                      {getLeadsForColumn(column.id).length}
                    </Badge>
                  </div>
                </div>
                <div className="px-2 mb-3 text-xs text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatMoney(getColumnValue(column.id))}
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[400px] rounded-lg transition-colors duration-200 ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                      data-testid={`column-${column.id}`}
                    >
                      {getLeadsForColumn(column.id).map((lead, index) => (
                        <Draggable key={lead.lead_id} draggableId={lead.lead_id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.9 : 1
                              }}
                            >
                              <KanbanCard lead={lead} onEdit={handleEdit} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>

      {isFormOpen && (
        <LeadFormDialog
          isOpen={isFormOpen}
          onClose={handleClose}
          onSuccess={onUpdate}
          lead={selectedLead}
        />
      )}

      {isCSVOpen && (
        <CSVUploadDialog
          isOpen={isCSVOpen}
          onClose={() => setIsCSVOpen(false)}
          onSuccess={onUpdate}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
