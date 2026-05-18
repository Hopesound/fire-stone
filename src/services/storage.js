const MANAGEMENT_KEY = "fireStoneManagement";

export function getManagementRecord(siteId) {
  const records = JSON.parse(localStorage.getItem(MANAGEMENT_KEY) || "{}");
  return records[siteId] || {};
}

export function saveManagementRecord(siteId, status, note) {
  const records = JSON.parse(localStorage.getItem(MANAGEMENT_KEY) || "{}");
  records[siteId] = {
    status,
    note,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(MANAGEMENT_KEY, JSON.stringify(records));
}
