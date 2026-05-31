export const getBackendUrl = () => {
  // If we are running on AI Studio environment, we can just use the relative URL (empty string)
  // this connects to the Express backend deployed in the same container.
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Check if we are running the app inside AI Studio (dev or preview share links)
    if (hostname.includes('run.app')) {
        return ''; 
    }
  }

  // If we are running on an Android app (APK), we need to point it to your deployed AI Studio backend url:
  return 'https://ais-pre-wyyvit24ko355j5q5txewh-224473533913.us-west1.run.app';
};
