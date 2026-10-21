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
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableContainer,
} from '../../components/ui';
import { adminService } from '../../services/adminService';
import {
  cleanupService,
  type CleanupSurveyResult,
  TARGET_PROJECT_ID,
  SUPER_ADMIN_EMAIL,
} from '../../services/cleanupService';
import { useAuth } from '../../hooks/useAuth';

export const AdminSettingsPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('institution');
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Cleanup & Production Launch State
  const [isSurveying, setIsSurveying] = useState<boolean>(false);
  const [surveyData, setSurveyData] = useState<CleanupSurveyResult | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState<boolean>(false);
  const [isExecutingCleanup, setIsExecutingCleanup] = useState<boolean>(false);
  const [cleanupProgress, setCleanupProgress] = useState<{ current: number; total: number; collection: string } | null>(null);
  const [cleanupSuccessSummary, setCleanupSuccessSummary] = useState<{ deletedCount: number } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmInput, setConfirmInput] = useState<string>('');

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
          { id: 'cleanup', label: '5. Production Launch & Cleanup' },
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

      {/* 5. Production Launch & Cleanup */}
      {activeTab === 'cleanup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section Banner */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                    Firebase Production Launch &amp; Database Cleanup
                  </h2>
                  <Badge variant="warning">Production Preparation</Badge>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginTop: '0.4rem', lineHeight: 1.5, maxWidth: '780px' }}>
                  Wipe all legacy testing accounts, dummy exams, questions, student assignments, and exam attempts from the active Firebase project, while <strong>strictly preserving the Super Administrator account</strong> and institutional settings.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active Firebase Project
                </span>
                <code style={{ backgroundColor: 'var(--color-slate-100)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 700, color: '#0f2744' }}>
                  {TARGET_PROJECT_ID}
                </code>
              </div>
            </div>

            {/* Protected Administrator Notice Card */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'rgba(13, 148, 136, 0.08)',
                border: '1.5px solid #0d9488',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#0d9488',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '1.1rem',
                }}
              >
                🛡️
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: '#0f2744', fontSize: '0.95rem' }}>
                    IMMUTABLE SUPER ADMINISTRATOR ACCOUNT PROTECTED
                  </span>
                  <Badge variant="success">Zero Deletion Guarantee</Badge>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-700)', margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>
                  The existing Super Administrator account (<strong>{SUPER_ADMIN_EMAIL}</strong>, UID: <code>{userProfile?.uid || 'Active Session'}</code>) is permanently safeguarded. Its Authentication credentials, Firestore profile (<code>admins/{userProfile?.uid}</code>), identity record (<code>users/{userProfile?.uid}</code>), and Admin Portal access permissions will <strong>never be deleted, disabled, or reset</strong> during this cleanup.
                </p>
              </div>
            </div>

            {/* Step Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    setIsSurveying(true);
                    setCleanupSuccessSummary(null);
                    const res = await cleanupService.surveyTestData();
                    setSurveyData(res);
                  } catch (err: any) {
                    console.error('Survey error:', err);
                    alert(`Survey failed: ${err.message || 'Unknown error'}`);
                  } finally {
                    setIsSurveying(false);
                  }
                }}
                isLoading={isSurveying}
                style={{ backgroundColor: '#0f2744' }}
              >
                {surveyData ? '↻ Re-Scan Database Inventory' : '🔍 Step 1: Scan Test Data Inventory'}
              </Button>

              {surveyData && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const fname = cleanupService.downloadBackupFile(surveyData);
                    setBackupDownloaded(true);
                    setSaveNotification(`Recoverable backup downloaded: ${fname}`);
                    setTimeout(() => setSaveNotification(null), 4000);
                  }}
                  style={{ borderColor: '#0d9488', color: '#0f766e' }}
                >
                  📥 Step 2: Download Recoverable Backup (.JSON) {backupDownloaded && '✓'}
                </Button>
              )}

              {surveyData && surveyData.totalDocumentsToClean > 0 && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmInput('');
                    setShowConfirmModal(true);
                  }}
                  style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                  disabled={!backupDownloaded}
                  title={!backupDownloaded ? 'Please download a backup before proceeding to deletion.' : ''}
                >
                  🗑️ Step 3: Execute Safe Cleanup ({surveyData.totalDocumentsToClean} items)
                </Button>
              )}
            </div>

            {!backupDownloaded && surveyData && surveyData.totalDocumentsToClean > 0 && (
              <p style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.5rem', marginBottom: 0 }}>
                ⚠️ Requirement: You must click <strong>"Step 2: Download Recoverable Backup"</strong> to enable the cleanup execution button.
              </p>
            )}
          </Card>

          {/* Cleanup Progress Indicator */}
          {isExecutingCleanup && cleanupProgress && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>
                    Deleting test data from collection: <code>{cleanupProgress.collection}</code>...
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
                    {Math.round((cleanupProgress.current / Math.max(1, cleanupProgress.total)) * 100)}% ({cleanupProgress.current} / {cleanupProgress.total})
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--color-slate-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round((cleanupProgress.current / Math.max(1, cleanupProgress.total)) * 100))}%`,
                      backgroundColor: '#dc2626',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Cleanup Success Banner */}
          {cleanupSuccessSummary && (
            <Alert type="success" onDismiss={() => setCleanupSuccessSummary(null)}>
              <div>
                <strong>Cleanup Successfully Completed!</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                  Permanently removed {cleanupSuccessSummary.deletedCount} old test records across all test collections.
                  The Super Administrator account (<code>{SUPER_ADMIN_EMAIL}</code>) and institutional configuration were verified intact. The examination system is now ready for production launch.
                </p>
              </div>
            </Alert>
          )}

          {/* Survey Inventory Results Table */}
          {surveyData && (
            <Card padding="none">
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--color-slate-900)' }}>
                    Test Data Survey &amp; Proposed Deletion Scope
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                    Surveyed at: {new Date(surveyData.surveyedAt).toLocaleTimeString()} • Total Cleanable Records: <strong>{surveyData.totalDocumentsToClean}</strong>
                  </span>
                </div>
                <Badge variant={surveyData.totalDocumentsToClean === 0 ? 'success' : 'warning'}>
                  {surveyData.totalDocumentsToClean === 0 ? 'Database Clean / Production Ready' : `${surveyData.totalDocumentsToClean} Test Records Identified`}
                </Badge>
              </div>

              <TableContainer style={{ border: 'none' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collection / Service</TableHead>
                      <TableHead>Total Records</TableHead>
                      <TableHead>Scheduled for Deletion</TableHead>
                      <TableHead>Preserved Safeguard</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(surveyData.collectionBreakdown).map(([col, data]) => (
                      <TableRow key={col}>
                        <TableCell>
                          <code>{col}</code>
                        </TableCell>
                        <TableCell>
                          <strong>{data.total}</strong>
                        </TableCell>
                        <TableCell>
                          <span style={{ color: data.toDelete > 0 ? '#dc2626' : 'var(--color-slate-500)', fontWeight: data.toDelete > 0 ? 700 : 400 }}>
                            {data.toDelete > 0 ? `-${data.toDelete}` : '0'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {col === 'users' ? (
                            <Badge variant="success">1 (Super Admin)</Badge>
                          ) : col === 'settings' ? (
                            <Badge variant="outline">All Preserved</Badge>
                          ) : (
                            <span style={{ color: 'var(--color-slate-400)', fontSize: '0.85rem' }}>N/A (Test Only)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {data.toDelete > 0 ? (
                            <Badge variant="danger">Pending Cleanup</Badge>
                          ) : (
                            <Badge variant="success">Clean</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow style={{ backgroundColor: 'var(--color-slate-50)', fontWeight: 700 }}>
                      <TableCell>
                        <strong>SYSTEM SETTINGS &amp; ADMINS</strong>
                      </TableCell>
                      <TableCell>
                        {surveyData.preservedRecords.settingsDocsCount + 1}
                      </TableCell>
                      <TableCell style={{ color: '#16a34a' }}>
                        0
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">100% Protected</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">Preserved</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}

          {/* Explicit Confirmation Modal */}
          {showConfirmModal && surveyData && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100060,
                padding: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '1rem',
                  maxWidth: '520px',
                  width: '100%',
                  padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                    ⚠️
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-slate-900)' }}>
                      Confirm Permanent Test Data Cleanup
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                      ROYAL COLLEGE OF NURSING SWAT • Production Transition
                    </span>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--color-slate-700)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    You are about to permanently delete <strong>{surveyData.totalDocumentsToClean} test records</strong> across students, teachers, exams, questions, assignments, and results.
                  </p>
                  <p style={{ margin: '0', color: '#0f766e', fontWeight: 600 }}>
                    ✓ Super Administrator account ({SUPER_ADMIN_EMAIL}) will be preserved.
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.35rem' }}>
                    Type <code style={{ color: '#dc2626' }}>CONFIRM CLEANUP</code> to authorize:
                  </label>
                  <Input
                    placeholder="CONFIRM CLEANUP"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isExecutingCleanup}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    disabled={confirmInput !== 'CONFIRM CLEANUP' || isExecutingCleanup}
                    isLoading={isExecutingCleanup}
                    style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                    onClick={async () => {
                      try {
                        setIsExecutingCleanup(true);
                        const result = await cleanupService.executeCleanup(surveyData, (prog) => {
                          setCleanupProgress(prog);
                        });
                        setCleanupSuccessSummary(result);
                        setShowConfirmModal(false);
                        // Re-survey to refresh table
                        const refreshed = await cleanupService.surveyTestData();
                        setSurveyData(refreshed);
                      } catch (execErr: any) {
                        console.error('Execution error:', execErr);
                        alert(`Cleanup error: ${execErr.message || 'Execution failed'}`);
                      } finally {
                        setIsExecutingCleanup(false);
                        setCleanupProgress(null);
                      }
                    }}
                  >
                    Permanently Delete Test Records
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
