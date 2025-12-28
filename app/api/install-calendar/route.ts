import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "bocce-calendar.mobileconfig");
    const fileContent = await readFile(filePath);

    return new Response(new Uint8Array(fileContent), {
      headers: {
        "Content-Type": "application/x-apple-aspen-config",
        "Content-Disposition":
          'attachment; filename="bocce-calendar.mobileconfig"',
      },
    });
  } catch {
    return new Response("Configuration file not found", { status: 404 });
  }
}
