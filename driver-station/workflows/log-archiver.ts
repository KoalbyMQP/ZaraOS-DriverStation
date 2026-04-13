/**
 * Example Workflow: Archive logs from running instances
 * 
 * This demonstrates using Vercel Workflow to periodically collect and archive
 * logs from all running instances. You can extend this to:
 * - Collect logs on a schedule (Cron Jobs)
 * - Stream logs to external storage (S3, database)
 * - Generate log reports
 * - Alert on errors in logs
 * 
 * Usage:
 *   const run = await start(logArchiverWorkflow, [instanceId, maxAgeHours]);
 */

import { sleep, fetch as workflowFetch, getWritable } from "workflow";

export type LogArchiveResult = {
  instanceId: string;
  logsCollected: number;
  bytesArchived: number;
  archivedAt: string;
};

/**
 * Step to fetch and process logs from a running instance
 */
async function collectInstanceLogs(instanceId: string, robotUrl: string) {
  "use step";
  
  // In production, you'd add proper authentication here
  const url = new URL(`/instances/${instanceId}/logs`, robotUrl);
  url.searchParams.set("stream", "false"); // Get all logs at once, not streaming
  url.searchParams.set("tail", "1000");
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.status}`);
  }
  
  return response.text();
}

/**
 * Step to upload logs to external storage
 */
async function uploadLogsToStorage(
  instanceId: string,
  content: string,
  bucketPath: string
) {
  "use step";
  
  const timestamp = new Date().toISOString();
  const filename = `logs-${instanceId}-${timestamp}.txt`;
  
  // Example: upload to S3, Vercel Blob, or your own storage
  // This is a placeholder - implement based on your storage backend
  console.log(`Would upload ${filename} to ${bucketPath}`);
  
  return {
    filename,
    size: content.length,
  };
}

/**
 * Main workflow: archive logs from an instance
 */
export async function logArchiverWorkflow(
  instanceId: string,
  robotUrl: string,
  bucketPath: string = "logs"
) {
  "use workflow";

  const writer = getWritable<{ status: string }>();

  try {
    // Step 1: Collect logs
    await writer.write({ status: `Collecting logs from ${instanceId}...` });
    const logContent = await collectInstanceLogs(instanceId, robotUrl);

    if (!logContent) {
      await writer.write({ status: "No logs to archive" });
      return { archived: false, reason: "No logs" };
    }

    // Step 2: Archive logs
    await writer.write({ status: "Archiving logs..." });
    const archiveResult = await uploadLogsToStorage(
      instanceId,
      logContent,
      bucketPath
    );

    await writer.write({
      status: `Successfully archived ${archiveResult.filename}`,
    });

    return {
      archived: true,
      instanceId,
      filename: archiveResult.filename,
      size: archiveResult.size,
      timestamp: new Date().toISOString(),
    } as LogArchiveResult;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    await writer.write({ status: `Error: ${message}` });
    throw error;
  }
}

export default logArchiverWorkflow;
