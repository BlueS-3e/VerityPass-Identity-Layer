// Simple client-side gate to remember which flow the user chose on the Home page.
// stored in localStorage as 'selected_flow' with values: 'attestation' | 'launchpad' | null

const KEY = 'selected_flow';

export function setSelectedFlow(flow) {
  try { localStorage.setItem(KEY, flow); } catch (e) {}
}

export function getSelectedFlow() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

export function clearSelectedFlow() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

export default { setSelectedFlow, getSelectedFlow, clearSelectedFlow };
