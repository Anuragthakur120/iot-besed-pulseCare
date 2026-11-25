import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Filter,
  Grid,
  List,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { StatusPill } from '@/components/StatusPill';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';

export default function PatientDirectory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Register Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dob: '',
    phone: '',
    emergencyName: '',
    emergencyPhone: ''
  });

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: search.trim(),
        sort: sortBy,
        order: sortOrder
      });
      if (statusFilter) query.set('status', statusFilter);

      const res = await api.get(`/api/patients?${query.toString()}`);
      if (res.data?.data) {
        setPatients(res.data.data.patients || []);
        setTotalPatients(res.data.data.pagination?.total || 0);
      }
    } catch (err) {
      addToast({
        title: 'Error loading patients',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page, statusFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPatients();
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        dob: formData.dob,
        phone: formData.phone || undefined,
        emergencyContact: formData.emergencyName
          ? {
              name: formData.emergencyName,
              phone: formData.emergencyPhone
            }
          : undefined
      };

      const res = await api.post('/api/patients', payload);
      const newPatient = res.data.data.patient;

      addToast({
        title: 'Patient Registered',
        message: `Registered ${newPatient.name} with ID: ${newPatient.patientId}`,
        type: 'success'
      });

      setIsRegisterModalOpen(false);
      setFormData({
        name: '',
        email: '',
        dob: '',
        phone: '',
        emergencyName: '',
        emergencyPhone: ''
      });
      fetchPatients();
    } catch (err) {
      addToast({
        title: 'Registration Failed',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#0c1626] p-6 rounded-2xl border border-[#E5EAF1] dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Patient Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Total {totalPatients} registered clinical records
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPatients}
            isLoading={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Patient</span>
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Patient ID, Name, or Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-[#F6F8FB] dark:bg-slate-900 text-[#0B1F3A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </form>

          {/* Right Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="disabled">Disabled</option>
            </select>

            {/* Sort Select */}
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':');
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-[#F6F8FB] dark:bg-slate-900">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="Card View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results View */}
      {viewMode === 'table' ? (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F8FB] dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#E5EAF1] dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-3">Patient ID</th>
                  <th className="py-3 px-3">Date of Birth</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800">
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No patient records found.
                    </td>
                  </tr>
                ) : (
                  patients.map((patient) => (
                    <tr
                      key={patient._id || patient.patientId}
                      onClick={() => navigate(`/doctor/patients/${patient.patientId}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={patient.name} size="sm" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-900 dark:text-white block group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                              {patient.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {patient.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                          {patient.patientId}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {patient.dob ? new Date(patient.dob).toLocaleDateString() : '--'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                        {patient.phone || '--'}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusPill status={patient.status === 'active' ? 'LIVE' : 'IDLE'} />
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => navigate(`/monitoring/live?patientId=${patient.patientId}`)}
                            className="text-teal-600 dark:text-teal-400 hover:border-teal-500"
                          >
                            Live
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => navigate(`/doctor/patients/${patient.patientId}`)}
                          >
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <Card
              key={patient._id || patient.patientId}
              onClick={() => navigate(`/doctor/patients/${patient.patientId}`)}
              className="p-5 cursor-pointer hover:border-teal-500/50 hover:shadow-md transition-all group space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={patient.name} size="md" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {patient.name}
                    </h3>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold inline-block mt-0.5">
                      {patient.patientId}
                    </span>
                  </div>
                </div>
                <StatusPill status={patient.status === 'active' ? 'LIVE' : 'IDLE'} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-[#E5EAF1] dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{patient.email}</span>
                </div>
                {patient.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{patient.phone}</span>
                  </div>
                )}
                {patient.dob && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>DOB: {new Date(patient.dob).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/monitoring/live?patientId=${patient.patientId}`);
                  }}
                  className="text-teal-600 dark:text-teal-400"
                >
                  Live Monitoring
                </Button>
                <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                  View Profile <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPatients > limit && (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0c1626] rounded-xl border border-[#E5EAF1] dark:border-slate-800 text-xs">
          <span className="text-slate-500">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalPatients)} of {totalPatients}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="font-mono px-2 font-semibold">{page}</span>
            <Button
              size="xs"
              variant="outline"
              disabled={page * limit >= totalPatients}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Register Patient Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Patient Record"
        size="md"
      >
        <form onSubmit={handleRegisterPatient} className="space-y-4 pt-2">
          <Input
            label="Full Legal Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. John Doe"
          />

          <Input
            label="Email Address (Used for portal invite)"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="patient@example.com"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date of Birth"
              type="date"
              required
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
            />
            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1-555-0101"
            />
          </div>

          <div className="pt-2 border-t border-[#E5EAF1] dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Emergency Contact (Optional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Contact Name"
                value={formData.emergencyName}
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                placeholder="Mary Doe"
              />
              <Input
                label="Contact Phone"
                type="tel"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                placeholder="+1-555-0102"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={registering}>
              Register Patient
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
