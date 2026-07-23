import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, Download } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CSVUploadDialog = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/leads/bulk-upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(response.data.message);
      onSuccess();
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => (typeof d === 'object' ? (d.msg || JSON.stringify(d)) : String(d))).join(', ')
        : (typeof detail === 'string' ? detail : 'Upload failed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'lead_name,company,email,phone,source,qualifier_name,closer_name,status,payment_type,project_type,technology_used,estimated_timeline,deposit_amount,total_deal_value,cash_collected,refund_clawback_amount,commission_percent,proposal_sent,monthly_retainer_amount,billing_frequency,contract_length_months,is_ongoing,currency,conversion_rate';
    const sample1 = 'John Doe,Acme Inc,john@acme.com,555-0100,Referral,Sarah,Mike,New,One-Time,Fixed-Scope Build,"React, Node.js",6 weeks,0,25000,0,0,15,false,0,,,,USD,1.0';
    const sample2 = 'Ali Khan,TechCo,ali@techco.pk,555-0200,Inbound,Sarah,Mike,Won,Recurring,Retainer,"Python, AWS",Ongoing,0,0,15000,0,10,true,5000,Monthly,12,false,PKR,0.0036';
    const blob = new Blob([headers + '\n' + sample1 + '\n' + sample2], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white" data-testid="csv-upload-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Bulk Upload Leads (CSV)</DialogTitle>
          <DialogDescription>
            Upload a CSV of your leads. Required: lead_name. Supports both One-Time and Recurring deals. Key columns: payment_type (One-Time/Recurring), project_type, monthly_retainer_amount, currency, conversion_rate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Button variant="outline" onClick={downloadTemplate} className="w-full border-dashed border-primary text-primary hover:bg-primary/5" data-testid="download-template-button">
            <Download size={16} strokeWidth={2} className="mr-2" />
            Download CSV Template
          </Button>

          <div>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} data-testid="csv-file-input" />
          </div>

          {file && (
            <div className="p-3 bg-background rounded-lg text-sm">
              <p className="font-medium text-foreground">Selected: {file.name}</p>
              <p className="text-xs text-muted-foreground">Size: {(file.size / 1024).toFixed(2)} KB</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={loading || !file} className="bg-primary hover:bg-primary-hover text-white" data-testid="upload-csv-button">
            <Upload size={16} strokeWidth={2} className="mr-2" />
            {loading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVUploadDialog;
