import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Upload, Search, FileText, Trash2, ExternalLink, Loader2, Download, Edit, Link, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  filename: string;
  doc_type: string;
  uploaded_at: string;
  raw_text?: string;
  summary?: string;
  action_items?: string;
  storage_path?: string;
  download_path?: string;
  processed?: boolean;
}

interface DocumentsPanelProps {
  projectId: string;
}

export interface DocumentsPanelRef {
  openUpload: () => void;
}

export const DocumentsPanel = forwardRef<DocumentsPanelRef, DocumentsPanelProps>(({ projectId }, ref) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadDialog, setUploadDialog] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [documentDetails, setDocumentDetails] = useState<Map<string, Document>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    openUpload: () => setUploadDialog(true)
  }), []);

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  const fetchDocuments = async () => {
    try {
      // Optimized query - fetch lightweight metadata including paths for download and processed field
      // Include raw_text for URL documents to enable link navigation
      const { data, error } = await supabase
        .from('documents')
        .select('id, filename, uploaded_at, doc_type, download_path, storage_path, processed, summary, raw_text')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      setDocuments(data || []);
      
      // Pre-populate document details for documents that already have summaries
      if (data) {
        const detailsMap = new Map();
        data.forEach(doc => {
          if (doc.processed && doc.summary) {
            detailsMap.set(doc.id, doc);
          }
        });
        setDocumentDetails(detailsMap);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDocumentDetails = async (documentId: string) => {
    // Check if we already have the details
    if (documentDetails.has(documentId)) {
      return documentDetails.get(documentId);
    }
    
    setLoadingDetails(prev => new Set(prev).add(documentId));
    
    try {
      // Fetch full details for a single document
      const { data, error } = await supabase
        .from('documents')
        .select('id, summary, action_items, raw_text')
        .eq('id', documentId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        // Merge with existing document data
        const existingDoc = documents.find(d => d.id === documentId);
        if (existingDoc) {
          const fullDoc = { ...existingDoc, ...data };
          setDocumentDetails(prev => new Map(prev).set(documentId, fullDoc));
          return fullDoc;
        }
      }
    } catch (err) {
      console.error('Error fetching document details:', err);
      toast({
        title: "Error",
        description: "Failed to load document details",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
    
    return null;
  };

  const getDocType = (filename: string, isUrl: boolean = false): string => {
    if (isUrl) return 'url';
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'docx': return 'docx';
      case 'xlsx': return 'xlsx';
      default: return 'other';
    }
  };

  const handleUpload = async () => {
    if (uploadType === 'file' && !file) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    if (uploadType === 'url' && !url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      if (uploadType === 'file' && file) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error('Only PDF, DOCX, and XLSX files are allowed');
        }

        // Create FormData for multipart/form-data upload
        const formData = new FormData();
        formData.append('file', file);

        // Upload to backend API
        const response = await api.post(
          `https://chronoboard-backend.onrender.com/api/projects/${projectId}/documents/`,
          formData
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || `Upload failed with status: ${response.status}`);
        }
      } else if (uploadType === 'url') {
        // For URLs, store them directly in the database without processing
        // Extract a meaningful filename from the URL
        let urlFilename = 'Link';
        try {
          const urlObj = new URL(url.trim());
          const pathParts = urlObj.pathname.split('/').filter(p => p);
          if (pathParts.length > 0) {
            urlFilename = pathParts[pathParts.length - 1] || urlObj.hostname;
          } else {
            urlFilename = urlObj.hostname;
          }
        } catch {
          // If URL parsing fails, use a generic name
          urlFilename = 'Web Link';
        }
        
        // Store the URL directly in the database
        const { error } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            filename: urlFilename,
            doc_type: 'url',
            raw_text: url.trim(),
            processed: true, // URLs don't need processing
            summary: null // URLs don't get summaries
          });
        
        if (error) {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      setUploadDialog(false);
      setFile(null);
      setUrl('');
      fetchDocuments();
    } catch (err) {
      console.error('Error uploading document:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string, filename: string) => {
    setDeleting(documentId);

    try {
      // Delete from database
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;

      // Try to delete from storage (might not exist for URLs)
      const { data: files } = await supabase.storage
        .from('documents')
        .list(projectId);

      const storageFile = files?.find(f => f.name === filename);
      if (storageFile) {
        await supabase.storage
          .from('documents')
          .remove([`${projectId}/${storageFile.name}`]);
      }

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete document",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (document: Document) => {
    // For URL documents, open in new tab
    if (document.doc_type === 'url') {
      if (document.raw_text) {
        window.open(document.raw_text, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    
    setDownloading(document.id);
    
    try {
      // Try download_path first, then storage_path, then use filename
      const downloadPath = document.download_path || document.storage_path || document.filename;
      
      if (!downloadPath) {
        throw new Error('No download path available for this document');
      }
      
      // Check if path already includes projectId
      const filePath = downloadPath.includes(projectId) 
        ? downloadPath 
        : `${projectId}/${downloadPath}`;
      
      console.log('Attempting download from:', filePath);
      
      // Use Supabase's download method
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);
      
      if (error) {
        console.error('Storage download error:', error);
        throw new Error(`Download failed: ${error.message}`);
      }
      
      if (data) {
        // Create blob URL and trigger download
        const url = URL.createObjectURL(data);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.filename || 'download';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Success",
          description: "File download started",
        });
      } else {
        throw new Error('No file data received');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleRename = async (documentId: string) => {
    if (!editingName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .update({ filename: editingName.trim() })
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document renamed successfully",
      });

      setEditingDoc(null);
      setEditingName('');
      fetchDocuments();
    } catch (err) {
      console.error('Error renaming document:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to rename document",
        variant: "destructive",
      });
    }
  };

  const handleGenerateSummary = async (documentId: string) => {
    setGeneratingSummary(documentId);

    try {
      const response = await api.post(
        `https://chronoboard-backend.onrender.com/api/documents/${documentId}/generate-summary`
      );

      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.status}`);
      }

      toast({
        title: "Success",
        description: "AI summary generated successfully",
      });

      // Clear cached details to force refresh
      setDocumentDetails(prev => {
        const newMap = new Map(prev);
        newMap.delete(documentId);
        return newMap;
      });
      
      // Fetch lightweight metadata again
      await fetchDocuments();
      
      // Always fetch the new details after generating summary
      await fetchDocumentDetails(documentId);
      
      // If summary wasn't expanded, expand it now to show the generated summary
      if (!expandedSummaries.has(documentId)) {
        setExpandedSummaries(prev => new Set(prev).add(documentId));
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setGeneratingSummary(null);
    }
  };

  const startEditing = (doc: Document) => {
    setEditingDoc(doc.id);
    setEditingName(doc.filename);
  };

  const toggleSummary = async (docId: string) => {
    const newExpanded = new Set(expandedSummaries);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      // Fetch full details when expanding to show summary
      await fetchDocumentDetails(docId);
      newExpanded.add(docId);
    }
    setExpandedSummaries(newExpanded);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDocIcon = (docType: string) => {
    switch (docType) {
      case 'url': return <Link className="h-4 w-4" />;
      case 'pdf': return <FileText className="h-4 w-4" />;
      case 'docx': return <FileText className="h-4 w-4" />;
      case 'xlsx': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getDocTypeLabel = (docType: string, filename?: string) => {
    // First check the docType field
    switch (docType?.toLowerCase()) {
      case 'url': return 'URL';
      case 'pdf': return 'PDF';
      case 'docx': return 'Word';
      case 'xlsx': return 'Excel';
      case 'doc': return 'Word';
      case 'xls': return 'Excel';
    }
    
    // If docType doesn't match, try to detect from filename
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'pdf': return 'PDF';
        case 'docx': return 'Word';
        case 'doc': return 'Word';
        case 'xlsx': return 'Excel';
        case 'xls': return 'Excel';
        case 'txt': return 'Text';
        case 'rtf': return 'RTF';
        case 'ppt': return 'PowerPoint';
        case 'pptx': return 'PowerPoint';
      }
    }
    
    // Fallback
    return 'Document';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Documents</h2>
        <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={uploadType === 'file' ? 'default' : 'outline'}
                  onClick={() => setUploadType('file')}
                  size="sm"
                >
                  File Upload
                </Button>
                <Button
                  type="button"
                  variant={uploadType === 'url' ? 'default' : 'outline'}
                  onClick={() => setUploadType('url')}
                  size="sm"
                >
                  URL/Link
                </Button>
              </div>

              {uploadType === 'file' ? (
                <div>
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported formats: PDF, DOCX, XLSX
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="url">URL</Label>
                   <Input
                     id="url"
                     value={url}
                     onChange={(e) => setUrl(e.target.value)}
                     placeholder="https://example.com/document or Figma link"
                   />
                  </div>
                )}

               <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setUploadDialog(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {documents.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-all duration-200 hover:border-primary/20">
              <CardHeader className="pb-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    {getDocIcon(doc.doc_type)}
                    <div className="flex-1 min-w-0">
                      {editingDoc === doc.id ? (
                        <div className="flex items-center space-x-1">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-7 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(doc.id);
                              if (e.key === 'Escape') setEditingDoc(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRename(doc.id)}
                            className="h-7 w-7 p-0"
                          >
                            ✓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingDoc(null)}
                            className="h-7 w-7 p-0"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <CardTitle className="text-sm font-medium truncate leading-tight">
                            {doc.filename}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getDocTypeLabel(doc.doc_type, doc.filename)} • {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => startEditing(doc)}
                     disabled={editingDoc === doc.id}
                     className="h-8 w-8 p-0"
                   >
                     <Edit className="h-3.5 w-3.5" />
                   </Button>
                   {doc.doc_type !== 'url' ? (
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => handleDownload(doc)}
                       disabled={downloading === doc.id}
                       className="h-8 w-8 p-0"
                     >
                       {downloading === doc.id ? (
                         <Loader2 className="h-3.5 w-3.5 animate-spin" />
                       ) : (
                         <Download className="h-3.5 w-3.5" />
                       )}
                     </Button>
                   ) : (
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => window.open(doc.raw_text, '_blank', 'noopener,noreferrer')}
                       className="h-8 w-8 p-0"
                     >
                       <Link className="h-3.5 w-3.5" />
                     </Button>
                   )}
                   <AlertDialog>
                     <AlertDialogTrigger asChild>
                       <Button
                         variant="ghost"
                         size="sm"
                         disabled={deleting === doc.id}
                         className="h-8 w-8 p-0"
                       >
                         {deleting === doc.id ? (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                         ) : (
                           <Trash2 className="h-3.5 w-3.5" />
                         )}
                       </Button>
                     </AlertDialogTrigger>
                     <AlertDialogContent>
                       <AlertDialogHeader>
                         <AlertDialogTitle>Delete Document</AlertDialogTitle>
                         <AlertDialogDescription>
                           Are you sure you want to delete "{doc.filename}"? This action cannot be undone.
                         </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                           onClick={() => handleDelete(doc.id, doc.filename)}
                           className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                           Delete
                         </AlertDialogAction>
                       </AlertDialogFooter>
                     </AlertDialogContent>
                   </AlertDialog>
                 </div>
                </div>
                
                {(() => {
                  const fullDoc = documentDetails.get(doc.id) || doc;
                  
                  // Skip AI summary for URLs
                  if (doc.doc_type === 'url') {
                    return null;
                  }
                  
                  // Check if document already has a summary or is processed
                  if (fullDoc.processed && fullDoc.summary) {
                    return (
                      <div className="mt-3">
                        <Collapsible 
                          open={expandedSummaries.has(doc.id)} 
                          onOpenChange={() => toggleSummary(doc.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between text-xs px-0 hover:bg-transparent"
                              disabled={loadingDetails.has(doc.id)}
                            >
                              <span>
                                {loadingDetails.has(doc.id) ? 'Loading...' : expandedSummaries.has(doc.id) ? 'Hide Summary' : 'Show Summary'}
                              </span>
                              {loadingDetails.has(doc.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : expandedSummaries.has(doc.id) ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                              {fullDoc.summary}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  }
                  
                  // Show Generate AI Summary button for non-processed documents
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateSummary(doc.id)}
                      disabled={generatingSummary === doc.id}
                      className="w-full h-8 text-xs"
                    >
                      {generatingSummary === doc.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          Generate AI Summary
                        </>
                      )}
                    </Button>
                  );
                })()}
               </CardHeader>
             </Card>
          ))}
        </div>
      )}
    </div>
  );
});