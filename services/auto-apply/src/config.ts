export const config = {
  port: parseInt(process.env.AUTO_APPLY_PORT || '8005', 10),
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  queueKey: 'apply:queue',
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY || 'resumeai',
    secretKey: process.env.S3_SECRET_KEY || 'resumeai_dev_secret',
    applyBucket: process.env.S3_BUCKET_APPLY || 'apply-artifacts',
    resumesBucket: process.env.S3_BUCKET_RESUMES || 'resumes-raw',
  },
  pollIntervalMs: 1500,
  // Auto-submit is OFF by default. Even when a user's preferences say
  // `defaultMode=auto`, we still pause at the submit step unless they have
  // explicitly opted into per-application full automation by setting
  // mode=auto on the POST /api/apply call.
  forceReviewMode: process.env.FORCE_REVIEW_MODE === 'true',
};
