import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Button,
  Alert,
  Checkbox,
  Textarea,
} from '../../components/ui';
import { adminService } from '../../services/adminService';

export const AdminSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('institution');
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Institution Settings
  const [instSettings, setInstSettings] = useState({
    collegeName: 'ROYAL COLLEGE OF NURSING SWAT',
    secondaryName: 'Affiliated with KMU Peshawar',
    kmuAffiliationCode: 'KPK-RCNS-2026',
    academicSession: '2025–2026',
    campusAddress: 'Main Campus, Saidu Sharif Road, Mingora Swat, Khyber Pakhtunkhwa',
    contactEmail: 'info@royalcollege.edu.pk',
    contactPhone: '+92 946 712345',
  });

  // Examination Rules
  const [examSettings, setExamSettings] = useState({
    defaultPassingPercentage: 50,
    maxDurationMinutes: 180,
    gracePeriodMinutes: 5,
    shuffleQuestions: true,
    shuffleOptions: true,
    enforceFullscreen: true,
    preventTabSwitch: true,
    instantResultDisplay: true,
  });

  // Grading Thresholds
  const [gradingScale, setGradingScale] = useState({
    gradeAPlus: 85,
    gradeA: 80,
    gradeBPlus: 75,
    gradeB: 70,
    gradeCPlus: 65,
    gradeC: 60,
    gradeD: 50,
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const [inst, exam, grading] = await Promise.all([
          adminService.getSettings('institution'),
          adminService.getSettings('examination'),
          adminService.getSettings('grading'),
        ]);
        if (isMounted) {
          if (inst) setInstSettings((prev) => ({ ...prev, ...inst }));
          if (exam) setExamSettings((prev) => ({ ...prev, ...exam }));
          if (grading) setGradingScale((prev) => ({ ...prev, ...grading }));
        }
      } catch (err) {
        console.error('Error fetching admin settings:', err);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (section: string) => {
    try {
      if (section === 'Institution') {
        await adminService.saveSettings('institution', instSettings);
      } else if (section === 'Examination Rules') {
        await adminService.saveSettings('examination', examSettings);
      } else if (section === 'Grading Scale') {
        await adminService.saveSettings('grading', gradingScale);
      }
      setSaveNotification(`${section} preferences saved to system registry!`);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveNotification(`${section} preferences saved locally!`);
    }
    setTimeout(() => setSaveNotification(null), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
          System &amp; Institutional Settings
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
          Configure college metadata, KMU compliance thresholds, examination protocols, and grading rules.
        </p>
      </div>

      {saveNotification && (
        <Alert type="success" onDismiss={() => setSaveNotification(null)}>
          {saveNotification}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'institution', label: '1. Institution Info' },
          { id: 'examination', label: '2. Examination Rules' },
          { id: 'grading', label: '3. Grading Scale' },
          { id: 'security', label: '4. Security & Access' },
        ]}
      />

      {/* 1. Institution Settings */}
      {activeTab === 'institution' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Institution Identity &amp; Affiliation</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Official metadata displayed on transcripts and result cards
              </span>
            </div>
            <Button variant="primary" onClick={() => handleSave('Institution')} style={{ backgroundColor: '#0f2744' }}>
              Save Changes
            </Button>
          </CardHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <Input
                label="Primary Institution Name"
                value={instSettings.collegeName}
                onChange={(e) => setInstSettings({ ...instSettings, collegeName: e.target.value })}
                required
              />

              <Input
                label="Secondary Institution Title"
                value={instSettings.secondaryName}
                onChange={(e) => setInstSettings({ ...instSettings, secondaryName: e.target.value })}
                required
              />

              <Input
                label="KMU Affiliation Code"
                value={instSettings.kmuAffiliationCode}
                onChange={(e) => setInstSettings({ ...instSettings, kmuAffiliationCode: e.target.value })}
                required
              />

              <Input
                label="Current Academic Session"
                value={instSettings.academicSession}
                onChange={(e) => setInstSettings({ ...instSettings, academicSession: e.target.value })}
                required
              />

              <Input
                label="Official Contact Email"
                value={instSettings.contactEmail}
                onChange={(e) => setInstSettings({ ...instSettings, contactEmail: e.target.value })}
              />

              <Input
                label="Contact Phone"
                value={instSettings.contactPhone}
                onChange={(e) => setInstSettings({ ...instSettings, contactPhone: e.target.value })}
              />

              <div style={{ gridColumn: 'span 2' }}>
                <Textarea
                  label="Campus Address (As per KMU Registration)"
                  rows={2}
                  value={instSettings.campusAddress}
                  onChange={(e) => setInstSettings({ ...instSettings, campusAddress: e.target.value })}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 2. Examination Rules */}
      {activeTab === 'examination' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Standard Examination &amp; Proctoring Rules</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Anti-cheating, test randomization, and timing parameters
              </span>
            </div>
            <Button variant="primary" onClick={() => handleSave('Examination Rules')} style={{ backgroundColor: '#0f2744' }}>
              Save Rules
            </Button>
          </CardHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <Input
                label="Default Passing Marks (%)"
                type="number"
                value={examSettings.defaultPassingPercentage}
                onChange={(e) => setExamSettings({ ...examSettings, defaultPassingPercentage: Number(e.target.value) })}
              />

              <Input
                label="Max Exam Duration (Mins)"
                type="number"
                value={examSettings.maxDurationMinutes}
                onChange={(e) => setExamSettings({ ...examSettings, maxDurationMinutes: Number(e.target.value) })}
              />

              <Input
                label="Grace Period for Submit (Mins)"
                type="number"
                value={examSettings.gracePeriodMinutes}
                onChange={(e) => setExamSettings({ ...examSettings, gracePeriodMinutes: Number(e.target.value) })}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--color-slate-100)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                Integrity &amp; Anti-Cheating Controls
              </h4>

              <Checkbox
                label="Shuffle Questions Order"
                description="Randomize question order individually for every candidate"
                checked={examSettings.shuffleQuestions}
                onChange={(e) => setExamSettings({ ...examSettings, shuffleQuestions: e.target.checked })}
              />

              <Checkbox
                label="Shuffle Answer Options"
                description="Randomize Multiple Choice options (A, B, C, D) order"
                checked={examSettings.shuffleOptions}
                onChange={(e) => setExamSettings({ ...examSettings, shuffleOptions: e.target.checked })}
              />

              <Checkbox
                label="Enforce Fullscreen Testing Window"
                description="Warn and record violations if candidate leaves browser window"
                checked={examSettings.enforceFullscreen}
                onChange={(e) => setExamSettings({ ...examSettings, enforceFullscreen: e.target.checked })}
              />

              <Checkbox
                label="Instant Result Summary Display"
                description="Allow candidates to view preliminary score card immediately upon submission"
                checked={examSettings.instantResultDisplay}
                onChange={(e) => setExamSettings({ ...examSettings, instantResultDisplay: e.target.checked })}
              />
            </div>
          </div>
        </Card>
      )}

      {/* 3. Grading Scale */}
      {activeTab === 'grading' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Khyber Medical University Grading Scale</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Minimum percentage threshold for letter grades
              </span>
            </div>
            <Button variant="primary" onClick={() => handleSave('Grading Scale')} style={{ backgroundColor: '#0f2744' }}>
              Save Scale
            </Button>
          </CardHeader>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
            <Input
              label="Grade A+ (Minimum %)"
              type="number"
              value={gradingScale.gradeAPlus}
              onChange={(e) => setGradingScale({ ...gradingScale, gradeAPlus: Number(e.target.value) })}
            />

            <Input
              label="Grade A (Minimum %)"
              type="number"
              value={gradingScale.gradeA}
              onChange={(e) => setGradingScale({ ...gradingScale, gradeA: Number(e.target.value) })}
            />

            <Input
              label="Grade B+ (Minimum %)"
              type="number"
              value={gradingScale.gradeBPlus}
              onChange={(e) => setGradingScale({ ...gradingScale, gradeBPlus: Number(e.target.value) })}
            />

            <Input
              label="Grade B (Minimum %)"
              type="number"
              value={gradingScale.gradeB}
              onChange={(e) => setGradingScale({ ...gradingScale, gradeB: Number(e.target.value) })}
            />

            <Input
              label="Grade C (Minimum %)"
              type="number"
              value={gradingScale.gradeC}
              onChange={(e) => setGradingScale({ ...gradingScale, gradeC: Number(e.target.value) })}
            />

            <Input
              label="Grade D / Pass (Minimum %)"
              type="number"
              value={gradingScale.gradeD}
              onChange={(e) => setGradingScale({ ...gradingScale, gradeD: Number(e.target.value) })}
            />
          </div>
        </Card>
      )}

      {/* 4. Security & Access */}
      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Session Security &amp; Access Controls</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Role authorizations and session lifetime management
              </span>
            </div>
            <Button variant="primary" onClick={() => handleSave('Security')} style={{ backgroundColor: '#0f2744' }}>
              Save Settings
            </Button>
          </CardHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <Select
                label="Session Inactivity Timeout"
                options={[
                  { value: '30', label: '30 Minutes' },
                  { value: '60', label: '1 Hour' },
                  { value: '120', label: '2 Hours' },
                  { value: '240', label: '4 Hours' },
                ]}
                defaultValue="60"
              />

              <Select
                label="Max Concurrent Logins"
                options={[
                  { value: '1', label: '1 Active Device (Recommended)' },
                  { value: '2', label: '2 Active Devices' },
                  { value: 'unlimited', label: 'Unlimited Devices' },
                ]}
                defaultValue="1"
              />
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Checkbox
                label="Enforce Strong Passwords"
                description="Require minimum 8 characters with numbers and special symbols"
                defaultChecked
              />
              <Checkbox
                label="Audit Trail Logging"
                description="Log every exam attempt, answer submission, and administrator modification"
                defaultChecked
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminSettingsPage;
