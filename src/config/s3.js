const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require("dotenv").config();

class MyS3Client {
  constructor() {
    // Create an S3 client
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    // Log initialization
    console.log("S3 client initialized successfully.");
  }

  // Upload a file to S3
  async uploadFile(fileBuffer, fileName, mimetype) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimetype,
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3.send(command);
      const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      console.log(`File uploaded successfully: ${fileUrl}`);
      return fileUrl; // Return the URL of the uploaded file
    } catch (err) {
      console.error("Error uploading to S3:", err);
      throw err;
    }
  }

  // ! Delete a file from S3
  async deleteFile(fileName) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
    };

    console.log("S3 DeleteObject Params:", params); // Debugging log

    try {
      const command = new DeleteObjectCommand(params);
      await this.s3.send(command);
      console.log(`File deleted successfully: ${fileName}`);
    } catch (err) {
      console.error("Error deleting from S3:", err);
      throw err;
    }
  }
  // Get a signed URL for a file
  async getFileUrl(fileName) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
    };

    try {
      const command = new GetObjectCommand(params);
      const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // URL expires in 1 hour
      console.log(`File URL generated successfully: ${url}`);
      return url;
    } catch (err) {
      console.error("Error generating file URL:", err);
      throw err;
    }
  }
}

// Create a singleton instance of the S3Client class
const s3Client = new MyS3Client();

module.exports = s3Client;
