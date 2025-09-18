import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Loader2, ChevronDown, FileText, Bot, User, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ChronoBoardAIProps {
  projectId: string;
}

interface Source {
  content: string;
  metadata?: any;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export const ChronoBoardAI = ({ projectId }: ChronoBoardAIProps) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [sessionId] = useState(`session-${Date.now()}`);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [chatHistory]);

  const toggleSource = (messageId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleAskAI = async () => {
    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: question,
      timestamp: new Date(),
    };

    setChatHistory(prev => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);
    
    try {
      // Direct fetch to backend API
      const response = await fetch('http://localhost:8000/api/chat/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          project_id: projectId,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle different error scenarios
      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: data.response || 'No response received from the AI.',
        sources: data.sources || [],
        timestamp: new Date(),
      };

      setChatHistory(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Error with AI query:', error);
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'error',
        content: error instanceof Error ? error.message : '❌ Something went wrong. Please try again.',
        timestamp: new Date(),
      };
      
      setChatHistory(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process AI query",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskAI();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          Ask ChronoBoard AI
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        {/* Chat History */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4 mb-4">
          <div className="space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Ask about the latest meetings, updates, or files...</p>
              </div>
            ) : (
              chatHistory.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.type === 'user' && "justify-end"
                  )}
                >
                  {message.type !== 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      {message.type === 'assistant' ? (
                        <Bot className="h-6 w-6 text-primary" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-destructive" />
                      )}
                    </div>
                  )}
                  
                  <div className={cn(
                    "flex flex-col max-w-[80%]",
                    message.type === 'user' && "items-end"
                  )}>
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2.5",
                        message.type === 'user' && "bg-primary text-primary-foreground",
                        message.type === 'assistant' && "bg-muted",
                        message.type === 'error' && "bg-destructive/10 text-destructive"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {/* Sources section */}
                    {message.sources && message.sources.length > 0 && (
                      <Collapsible
                        open={expandedSources.has(message.id)}
                        onOpenChange={() => toggleSource(message.id)}
                        className="mt-2 w-full"
                      >
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <FileText className="h-3 w-3" />
                          <span>{message.sources.length} sources</span>
                          <ChevronDown className={cn(
                            "h-3 w-3 transition-transform",
                            expandedSources.has(message.id) && "rotate-180"
                          )} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          {message.sources.map((source, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-background/50 rounded p-2 border"
                            >
                              <p className="line-clamp-3">{source.content}</p>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    
                    <span className="text-xs text-muted-foreground mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {message.type === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-3">
                <Bot className="h-6 w-6 text-primary animate-pulse" />
                <div className="bg-muted rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Input Section */}
        <div className="flex gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about the latest meetings, updates, or files..."
            disabled={isLoading}
            className="flex-1 min-h-[50px] max-h-[100px] resize-none"
            rows={2}
          />
          <Button 
            onClick={handleAskAI} 
            disabled={isLoading || !question.trim()}
            size="icon"
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};