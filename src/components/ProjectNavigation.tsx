import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BarChart3, FileText, Clock } from 'lucide-react';

export type ProjectSection = 'overview' | 'documents' | 'timeline';

interface ProjectNavigationProps {
  currentSection: ProjectSection;
  onSectionChange: (section: ProjectSection) => void;
}

export const ProjectNavigation = ({ currentSection, onSectionChange }: ProjectNavigationProps) => {
  const sections = [
    {
      id: 'overview' as ProjectSection,
      label: 'Overview',
      icon: BarChart3,
    },
    {
      id: 'documents' as ProjectSection,
      label: 'Documents',
      icon: FileText,
    },
    {
      id: 'timeline' as ProjectSection,
      label: 'Timeline',
      icon: Clock,
    },
  ];

  return (
    <div className="flex space-x-1 bg-muted/30 p-1 rounded-lg mb-6">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = currentSection === section.id;
        
        return (
          <Button
            key={section.id}
            variant={isActive ? 'default' : 'ghost'}
            onClick={() => onSectionChange(section.id)}
            className={cn(
              'flex-1 flex items-center justify-center space-x-2 h-10 transition-all',
              isActive && 'shadow-sm'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{section.label}</span>
          </Button>
        );
      })}
    </div>
  );
};