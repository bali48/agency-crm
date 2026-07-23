import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import axios from 'axios';
import { toast } from 'sonner';
import { Save, Activity } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DailyActivityForm = ({ user }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    qualifier_name: user?.name || '',
    date: new Date().toISOString().split('T')[0],
    outreach_sent: 0,
    conversations: 0
  });

  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/daily-activities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleSubmit = async () => {
    if (!formData.qualifier_name) {
      toast.error('Qualifier name is required');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/daily-activities`, {
        ...formData,
        date: new Date(formData.date).toISOString(),
        outreach_sent: parseInt(formData.outreach_sent) || 0,
        conversations: parseInt(formData.conversations) || 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Activity recorded');
      setFormData({
        qualifier_name: user?.name || '',
        date: new Date().toISOString().split('T')[0],
        outreach_sent: 0,
        conversations: 0
      });
      fetchActivities();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => (typeof d === 'object' ? (d.msg || JSON.stringify(d)) : String(d))).join(', ')
        : (typeof detail === 'string' ? detail : 'Failed to record activity');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Daily Activity</h2>
        <p className="text-sm text-muted-foreground mt-1">Log your daily outreach (calls/emails/DMs) and conversations for tracking</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Activity className="text-primary" size={20} strokeWidth={2} />
              </div>
              <div>
                <CardTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Log Today's Activity</CardTitle>
                <CardDescription>Quick daily input form</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Qualifier Name</Label>
              <Input value={formData.qualifier_name} onChange={(e) => setFormData({...formData, qualifier_name: e.target.value})} data-testid="activity-qualifier-input" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} data-testid="activity-date-input" />
            </div>
            <div>
              <Label>Outreach Sent (calls / emails / DMs)</Label>
              <Input type="number" value={formData.outreach_sent} onChange={(e) => setFormData({...formData, outreach_sent: e.target.value})} data-testid="activity-outreach-input" />
            </div>
            <div>
              <Label>Conversations</Label>
              <Input type="number" value={formData.conversations} onChange={(e) => setFormData({...formData, conversations: e.target.value})} data-testid="activity-conversations-input" />
            </div>
            <Button onClick={handleSubmit} disabled={loading} className="w-full bg-primary hover:bg-primary-hover text-white" data-testid="save-activity-button">
              <Save size={16} strokeWidth={2} className="mr-2" />
              {loading ? 'Saving...' : 'Record Activity'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Recent Activities</CardTitle>
            <CardDescription>Last 20 daily entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Qualifier</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Outreach</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Convos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No activities yet</TableCell>
                    </TableRow>
                  ) : activities.slice(0, 20).map(a => (
                    <TableRow key={a.activity_id}>
                      <TableCell className="text-sm">{a.qualifier_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(a.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{a.outreach_sent}</TableCell>
                      <TableCell className="text-right font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{a.conversations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DailyActivityForm;
