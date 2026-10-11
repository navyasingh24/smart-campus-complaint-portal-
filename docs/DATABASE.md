# Database Design (Amazon DynamoDB)

DynamoDB is a key-value / document database. Unlike SQL databases, you design
tables around the **queries you need**, because efficient reads must use a key
or an index. A `Scan` reads the whole table and gets slower and more expensive
as data grows, so this project never scans.

## 1. Tables

### Users table (`<app>-users`)

| Attribute | Type | Notes |
| --- | --- | --- |
| **email** (partition key) | String | Lower-cased. Being the key makes it unique: registration uses `attribute_not_exists(email)` |
| userId | String (UUID) | Stable identifier stored in the login token and on complaints |
| name | String | |
| passwordHash | String | bcrypt hash (cost 10). The plain password is never stored |
| role | String | `STUDENT` or `ADMIN` |
| createdAt, updatedAt | String (ISO-8601) | |

### Complaints table (`<app>-complaints`)

| Attribute | Type | Notes |
| --- | --- | --- |
| **complaintId** (partition key) | String (UUID) | |
| userId | String | Owner (from the verified token, never from the request) |
| studentName, studentEmail | String | Copied from the token so the admin list needs no extra lookup (denormalisation) |
| title, description, category, location | String | `location` may be null |
| status | String | `PENDING`, `IN_PROGRESS`, `RESOLVED` |
| adminNote | String / null | Optional note shown to the student |
| updatedBy | String | userId of the admin who last changed the status |
| createdAt, updatedAt | String (ISO-8601) | ISO strings sort correctly as text |

### Global secondary indexes (GSIs) on Complaints

| Index | Partition key | Sort key | Used for |
| --- | --- | --- | --- |
| `userId-createdAt-index` | userId | createdAt | "My complaints", newest first |
| `status-createdAt-index` | status | createdAt | Admin list, admin status filter, statistics |

Both use projection `ALL` (the index holds a full copy of each item), so a
query never needs a second read. The cost is roughly double storage and write
units, which is negligible for this project.

## 2. Access patterns

| Use case | Operation |
| --- | --- |
| Register | `PutItem` Users with `attribute_not_exists(email)` |
| Login | `GetItem` Users by email |
| Submit complaint | `PutItem` Complaints with `attribute_not_exists(complaintId)` |
| View one complaint | `GetItem` by complaintId, then ownership check in code |
| Student list (+ filters) | `Query` userId-createdAt-index, `ScanIndexForward=false`; status/category as `FilterExpression` |
| Admin list, no status filter | 3 × `Query` status-createdAt-index (one per status), merged and sorted by date |
| Admin list, status filter | 1 × `Query` on that status; category as `FilterExpression` |
| Update status | `UpdateItem` with `attribute_exists(complaintId)`, returns the new item. DynamoDB updates the GSIs automatically |
| Dashboard statistics | 3 × `Query` status index with `ProjectionExpression: status, category` |
| Readiness check | `GetItem` on a non-existent user key |

## 3. Trade-offs (useful for the viva)

* **Filter expressions are applied after reading.** A category filter still
  reads every item in the queried partition and then discards non-matching
  ones. It is simple and fine for thousands of complaints. If category filtering
  became heavy, add a `category-createdAt-index`.
* **Low-cardinality status index.** Only three partition-key values exist, so
  each status partition can become "hot" at very high write rates (thousands
  per second). A campus system is far below that. At scale, the key could be
  sharded (e.g. `PENDING#3`).
* **Statistics are computed by reading.** Counting reads every complaint's two
  small attributes. At large scale, keep pre-computed counters, updated with
  atomic `ADD` operations or DynamoDB Streams + Lambda.
* **Safety limit.** Each list query stops after 1,000 items
  (`MAX_ITEMS_PER_QUERY`). Adding pagination to the API and UI is a listed
  future enhancement.
* **Denormalised student name/email.** If a student could change their name,
  old complaints would show the old name. Name changes are not a feature, so
  this is acceptable and avoids an extra read per complaint.
* **Email as the Users key.** Makes uniqueness and login lookups trivial; the
  downside is that changing an email would mean moving the item (not supported).
* **On-demand capacity (`PAY_PER_REQUEST`).** No capacity planning and near-zero
  cost when idle; provisioned capacity can be cheaper for steady, high traffic.

## 4. Local development

* `DB_DRIVER=local`: `backend/src/db/localStore.js` keeps the same data shapes in
  memory and saves them to `backend/data/local-db.json` after each change, so data
  survives restarts. Tests use it without a file.
* `docker compose up`: runs [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
  and creates the same tables and indexes with `backend/scripts/create-tables.js`,
  so the real DynamoDB adapter can be tested offline.
