# API Reference

Base path: `/api`. All request and response bodies are JSON. Requests that
change data (`POST`, `PATCH`) **must** send `Content-Type: application/json`
(otherwise `415`). Authentication uses the `scc_token` httpOnly cookie that
`/auth/register` and `/auth/login` set.

Error format:

```json
{ "error": "Validation failed", "details": { "title": "Title must be between 5 and 120 characters" } }
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid input (`details` lists each field) or malformed JSON |
| 401 | Not logged in, or the session is invalid/expired |
| 403 | Logged in but the role is not allowed |
| 404 | Not found (also returned for another student's complaint) |
| 409 | Email already registered |
| 415 | Body is not JSON |
| 429 | Too many login/registration attempts (20 per 15 minutes per IP) |
| 500 | Unexpected server error (generic message, details only in server logs) |
| 503 | Readiness check failed (database unreachable) |

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | Liveness: `{ status, version, environment, uptimeSeconds, timestamp }` |
| GET | `/health/ready` | none | Readiness: checks the database. `200 { status: "ok", database }` or `503` |

## Authentication

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | none | `{ name, email, password }` | `201 { user }` + cookie. Always creates a `STUDENT` |
| POST | `/auth/login` | none | `{ email, password }` | `200 { user }` + cookie, or `401` |
| POST | `/auth/logout` | none | `{}` | `200`, clears the cookie |
| GET | `/auth/me` | any user | – | `200 { user }` or `401` |

Rules: name 2–80 characters; valid email; password 8–72 characters with at
least one letter and one number. `user` = `{ userId, name, email, role }`.

## Student complaints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/complaints` | STUDENT | Create. Body `{ title, description, category, location? }` → `201 { complaint }` |
| GET | `/complaints?status=&category=` | STUDENT | Own complaints, newest first → `{ complaints: [...] }` |
| GET | `/complaints/:id` | owner or ADMIN | One complaint → `{ complaint }`; other students get `404` |

Rules: title 5–120, description 10–2000, location ≤ 120 characters; category one of
`WIFI, CLASSROOM, HOSTEL, ELECTRICITY, SANITATION, OTHER`; status filter one of
`PENDING, IN_PROGRESS, RESOLVED`. Fields such as `status` or `userId` in the
create body are ignored.

Complaint object:

```json
{
  "complaintId": "26c8ca1d-1430-48c1-8663-7cd92af9d573",
  "userId": "1f798c63-8806-4aaf-a475-a84d8b5b9e8d",
  "studentName": "Riya Sharma",
  "studentEmail": "riya@campus.edu",
  "title": "Wi-Fi drops in Lab 3",
  "description": "The Wi-Fi disconnects every few minutes.",
  "category": "WIFI",
  "location": "Block B, Lab 3",
  "status": "IN_PROGRESS",
  "adminNote": "Technician assigned",
  "updatedBy": "27db6575-3240-4cd7-9a40-44d8589f3158",
  "createdAt": "2026-10-11T13:12:01.000Z",
  "updatedAt": "2026-10-11T14:02:44.000Z"
}
```

## Administrator

All routes require role `ADMIN` (students get `403`, anonymous users `401`).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/complaints?status=&category=` | All complaints, newest first |
| PATCH | `/admin/complaints/:id/status` | Body `{ status, adminNote? }` (note ≤ 500 chars) → `{ complaint }`; `404` if missing |
| GET | `/admin/stats` | `{ stats: { total, byStatus: {PENDING, IN_PROGRESS, RESOLVED}, byCategory: {...} } }` |

## Trying the API with curl

```bash
# Register (stores the session cookie in cookies.txt)
curl -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Test Student","email":"test@campus.edu","password":"Password123"}' \
  http://localhost:8080/api/auth/register

# Create a complaint
curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"title":"Projector broken","description":"Projector in room 101 shows no image.","category":"CLASSROOM","location":"Room 101"}' \
  http://localhost:8080/api/complaints

# List my complaints, filtered
curl -b cookies.txt 'http://localhost:8080/api/complaints?category=CLASSROOM'

# Try an admin route as a student → 403
curl -i -b cookies.txt http://localhost:8080/api/admin/stats
```
