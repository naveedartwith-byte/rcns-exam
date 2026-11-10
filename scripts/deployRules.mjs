import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

async function deployFirestoreRules() {
  console.log('Authenticating with service account...');
  const auth = new GoogleAuth({
    keyFile: 'royal-college-exam-system-firebase-adminsdk-fbsvc-d0043821f3.json',
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']
  });
  const client = await auth.getClient();
  const projectId = 'royal-college-exam-system';

  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
  console.log('Read firestore.rules (' + rulesContent.length + ' bytes)');

  console.log('Creating ruleset via firebaserules.googleapis.com...');
  const createRes = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    method: 'POST',
    data: {
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesContent
          }
        ]
      }
    }
  });

  const rulesetName = createRes.data.name;
  console.log('Created ruleset:', rulesetName);

  console.log('Updating release cloud.firestore...');
  const releaseRes = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    method: 'PATCH',
    data: {
      release: {
        name: `projects/${projectId}/releases/cloud.firestore`,
        rulesetName: rulesetName
      }
    }
  });

  console.log('Release updated successfully:', releaseRes.data.rulesetName);
  console.log('Rules deployment COMPLETE!');
}

deployFirestoreRules().catch((err) => {
  console.error('Rules deployment FAILED:', err.response?.data || err.message || err);
  process.exit(1);
});
