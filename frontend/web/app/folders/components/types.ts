// Single source of truth for all DMS view modes — kept here so useDmsWorkspace and
// every sidebar link derive the same literals without redeclaring the union in each file.
export type ViewMode = 'view-all' | 'recent' | 'favorites' | 'shared' | 'trash';
