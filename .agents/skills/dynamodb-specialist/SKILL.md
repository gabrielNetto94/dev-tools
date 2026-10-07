---
name: dynamodb-specialist
description: DynamoDB and NoSQL specialist for dblab. Use for DynamoDB operations, table inspection, item/variable editing, AWS SDK (@aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb), and DynamoDB Local integration.
---

# DynamoDB Specialist

## Context
- Module: DynamoDB Workbench (`app/dynamodb.js` and `app/public/dynamodb.js`).
- Uses `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` (`DynamoDBDocumentClient`).
- Supports both AWS Cloud (Region, Access Key, Secret Key, Session Token) and local endpoints (`http://localhost:8000` or `http://localstack:4566`).
- Credentials fallback to server environment (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DYNAMODB_ENDPOINT`).
- Last connection settings are persisted in browser `localStorage` (`dblab_dynamo_connection`) and restored automatically on load.

## Guidelines
- **Credentials & Security**: Never send AWS credentials via GET query parameters. Always use POST request bodies. Never log secret keys to console or return them in plain text.
- **Client Instantiation**: Create clients dynamically based on request options (region, endpoint, credentials) or use server defaults. Reuse or configure short timeout bounds.
- **Document Client**: Use `DynamoDBDocumentClient.from(client)` for clean JavaScript object serialization and unmarshaling.
- **Primary Keys**: Always inspect the table's `KeySchema` (`HASH` / Partition Key and `RANGE` / Sort Key) using `DescribeTableCommand` before running queries or item updates.
- **Variable & Item Editing**:
  - Support attribute types: String, Number, Boolean, Map (JSON), List, Null.
  - Converting types: sanitize input numbers into numeric values, booleans to true/false, and valid JSON into JavaScript Objects.
  - Primary key attributes cannot be changed once an item is created. When updating an item, preserve key identity.
- **Pagination**: Handle `ExclusiveStartKey` and `LastEvaluatedKey` for large tables in `ScanCommand` and `QueryCommand`.
- **Local Testing**: Support `amazon/dynamodb-local` running on port 8000.
