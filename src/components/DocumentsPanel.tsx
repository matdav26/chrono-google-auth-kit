import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Search, FileText, Trash2, ExternalLink, Loader2, Download, Edit, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  filename: string;
  doc_type: string;
  uploaded_at: string;
  raw_text?: string;
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
  const [filename, setFilename] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    openUpload: () => setUploadDialog(true)
  }), []);

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      setDocuments(data || []);
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
    if (!filename.trim()) {
      toast({
        title: "Error",
        description: "Please enter a filename",
        variant: "destructive",
      });
      return;
    }

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
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error('Only PDF, DOCX, XLSX, and TXT files are allowed');
        }

        // Validate file size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error('File size must be less than 10MB');
        }

        // Create unique filename to avoid conflicts
        const fileExtension = file.name.split('.').pop();
        const uniqueFilename = `${Date.now()}_${filename.trim()}.${fileExtension}`;
        const storagePath = `${projectId}/${uniqueFilename}`;

        // Upload file to Supabase storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file);

        if (storageError) {
          throw new Error(`Upload failed: ${storageError.message}`);
        }

        // Read file content for text extraction (basic implementation)
        let rawText = '';
        if (file.type === 'text/plain') {
          rawText = await file.text();
        } else {
          // For other file types, we'll store the filename as placeholder
          // In a real implementation, you'd want to extract text content
          rawText = `File: ${file.name}`;
        }

        // Insert document record into database
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            filename: filename.trim(),
            doc_type: getDocType(file.name),
            raw_text: rawText,
            processed: true
          })
          .select()
          .single();

        if (docError) {
          // Clean up storage file if database insert failed
          await supabase.storage.from('documents').remove([storagePath]);
          throw new Error(`Database error: ${docError.message}`);
        }

      } else if (uploadType === 'url') {
        // For URLs, store the URL in raw_text field
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            filename: filename.trim(),
            doc_type: 'url',
            raw_text: url.trim(),
            processed: true
          })
          .select()
          .single();

        if (docError) {
          throw new Error(`Database error: ${docError.message}`);
        }
      }

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      setUploadDialog(false);
      setFilename('');
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
    if (document.doc_type === 'url') return; // Can't download URLs
    
    setDownloading(document.id);
    
    try {
      // List files in the project folder to find the actual stored file
      const { data: files } = await supabase.storage
        .from('documents')
        .list(projectId);

      // Find file that contains the document filename (since we prepend timestamp)
      const storageFile = files?.find(f => f.name.includes(document.filename));
      if (!storageFile) {
        throw new Error('File not found in storage');
      }

      // Get download URL
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(`${projectId}/${storageFile.name}`, 60);

      if (data?.signedUrl) {
        // Create a temporary link and trigger download
        const link = window.document.createElement('a');
        link.href = data.signedUrl;
        link.download = document.filename;
        link.click();
        
        toast({
          title: "Success",
          description: "File download started",
        });
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

  const startEditing = (doc: Document) => {
    setEditingDoc(doc.id);
    setEditingName(doc.filename);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDocIcon = (docType: string) => {
    switch (docType) {
      case 'url': return <Link className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
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
              <div>
                <Label htmlFor="filename">Document Name</Label>
                <Input
                  id="filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="Enter a custom name for this document"
                />
              </div>
              
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
              <CardHeader className="pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getDocIcon(doc.doc_type)}
                    {editingDoc === doc.id ? (
                      <div className="flex items-center space-x-2 flex-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 text-sm"
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
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingDoc(null)}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <CardTitle className="text-sm font-medium truncate">
                          {doc.filename}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.doc_type.toUpperCase()} • {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(doc)}
                      disabled={editingDoc === doc.id}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {doc.doc_type !== 'url' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloading === doc.id}
                      >
                        {downloading === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doc.raw_text, '_blank', 'noopener,noreferrer')}
                      >
                        <Link className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleting === doc.id}
                        >
                          {deleting === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
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
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});