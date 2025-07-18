import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export default function NewProject() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get current user from session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("No authenticated user found");
      }

      console.log("Creating project:", { name, description, created_by: user.id });
      
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name,
          description, 
          created_by: user.id, // Explicitly set the created_by field
        })
        .select()
        .single();
      
      if (projectError) {
        console.error("Project creation failed:", projectError);
        throw projectError;
      }
      
      console.log("Project created successfully:", project);

      // ✅ Create project membership - make creator the owner
      const membershipPayload = {
        project_id: project.id,
        user_id: user.id,
        role: "owner" as const,
      };
      
      console.log("Creating project membership:", membershipPayload);
      
      const { data: membershipResult, error: membershipError } = await supabase
        .from("project_memberships")
        .insert(membershipPayload)
        .select();

      if (membershipError) {
        console.error("Project membership creation failed:", membershipError);
        throw membershipError;
      } else {
        console.log("Project membership created successfully:", membershipResult);
      }

      // ✅ Success! Navigate to projects page
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      
      navigate("/projects");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error creating project",
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2" />
          Sign Out
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm mb-2">
              Project Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter project name"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm mb-2">
              Description (Optional)
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description"
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </Card>
    </div>
  );
}