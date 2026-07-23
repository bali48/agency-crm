import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { LogOut, LayoutGrid, List, BarChart3, TrendingUp, Activity } from 'lucide-react';
import KanbanBoard from '@/components/KanbanBoard';
import LeadLog from '@/components/LeadLog';
import DashboardMetrics from '@/components/DashboardMetrics';
import ProjectionModule from '@/components/ProjectionModule';
import DailyActivityForm from '@/components/DailyActivityForm';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('kanban');

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeads(response.data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-container" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center">
              <TrendingUp className="text-white" size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Sales Tracker
              </h1>
              <p className="text-xs text-muted-foreground">CRM Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-medium" data-testid="user-role-badge">
              {currentUser.role}
            </Badge>
            <div className="flex items-center gap-2">
              <Avatar className="w-9 h-9">
                <AvatarImage src={currentUser.picture} alt={currentUser.name} />
                <AvatarFallback className="bg-primary text-white text-sm">
                  {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button" className="border-border hover:bg-background">
              <LogOut size={16} strokeWidth={2} />
              <span className="hidden md:inline ml-2">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-5 mb-8 bg-white border border-border p-1 rounded-xl">
            <TabsTrigger value="kanban" data-testid="kanban-tab" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2">
              <LayoutGrid size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Kanban</span>
            </TabsTrigger>
            <TabsTrigger value="log" data-testid="log-tab" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2">
              <List size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Lead Log</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" data-testid="metrics-tab" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2">
              <BarChart3 size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="projection" data-testid="projection-tab" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2">
              <TrendingUp size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Projection</span>
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="activity-tab" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2">
              <Activity size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Daily</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-0">
            <KanbanBoard leads={leads} onUpdate={fetchLeads} user={currentUser} />
          </TabsContent>

          <TabsContent value="log" className="mt-0">
            <LeadLog leads={leads} onUpdate={fetchLeads} user={currentUser} />
          </TabsContent>

          <TabsContent value="metrics" className="mt-0">
            <DashboardMetrics leads={leads} />
          </TabsContent>

          <TabsContent value="projection" className="mt-0">
            <ProjectionModule leads={leads} />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <DailyActivityForm user={currentUser} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
