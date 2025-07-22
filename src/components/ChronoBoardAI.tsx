import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChronoBoardAIProps {
  projectId: string;
}

export const ChronoBoardAI = ({ projectId }: ChronoBoardAIProps) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAskAI = async () => {
    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // TODO: Implement actual AI integration
      // For now, simulate a response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setResponse(`I understand you're asking about "${question}". This AI feature will help you analyze your project data including recent meetings, file uploads, and activity patterns. The integration is coming soon!`);
      
      toast({
        title: "ChronoBoard AI",
        description: "AI analysis complete",
      });
    } catch (error) {
      console.error('Error with AI query:', error);
      toast({
        title: "Error",
        description: "Failed to process AI query",
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
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-4">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Ask ChronoBoard AI</h3>
        </div>
        
        <div className="flex space-x-2 mb-4">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about the latest meetings, updates, or files..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={handleAskAI} 
            disabled={isLoading || !question.trim()}
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {response && (
          <div className="bg-muted/50 rounded-lg p-3 border-l-4 border-primary">
            <p className="text-sm">{response}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};