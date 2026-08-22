import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  // MVP: read-only view of defaults. Templates become editable when settings
  // persistence moves into the settings table.
  return (
    <div className="mx-auto h-full w-full max-w-xl space-y-4 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Naming templates</CardTitle>
          <CardDescription>
            Placeholders:{" "}
            {
              "{title} {year} {season} {episode} {resolution} {codec} {language}"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-movie">Movie</Label>
            <Input id="tpl-movie" value="{title} {year}" readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-tv">TV episode</Label>
            <Input
              id="tpl-tv"
              value="{title} S{season:02} E{episode:02}"
              readOnly
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Folder organization</CardTitle>
          <CardDescription>Applied when organizing a library.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Movies/&lt;Title&gt;/&lt;file&gt;</p>
          <p>TV Shows/&lt;Title&gt;/Season NN/&lt;file&gt;</p>
        </CardContent>
      </Card>
    </div>
  );
}
