'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function TeamRegistrationPage() {
  const [teamId, setTeamId] = useState('');

  useEffect(() => {
    // Generate a random 6-digit number for the team ID
    const randomId = Math.floor(100000 + Math.random() * 900000).toString();
    setTeamId(randomId);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Team Registration</CardTitle>
          <CardDescription>Create your team and add your members.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input id="projectName" placeholder="Enter your project's name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamId">Team ID</Label>
              <Input id="teamId" value={teamId} readOnly placeholder="A unique number for your team" />
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Team Members</h3>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`member${i}`}>{`Member ${i} ID`}</Label>
                  <Input
                    id={`member${i}`}
                    placeholder={i === 1 ? 'Enter Unique ID' : `Enter ID for member ${i}`}
                    required
                  />
                </div>
              ))}
            </div>
            <Button type="submit" className="w-full">
              Register Team
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
