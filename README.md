# S.W.A.P.

Developed by CORE Technologies.

**Smart Workflow Allocation & Placement** is a local school tool for preparing daily
teacher substitutions. It helps the coordinator identify classes that need cover, find
available teachers, review the proposed allocation, and print the final timetable.

S.W.A.P. runs on the school laptop only. It does not require an internet connection or
teacher accounts, and it does not send timetable or staff data to a cloud service.

## What S.W.A.P. does

- Stores the school's faculty and class-wise timetables.
- Supports a separate faculty timetable and student class-wise timetable.
- Supports multiple timetable uploads, including separate ICSE and ISC files.
- Reads standard table PDFs and aSc timetable PDFs.
- Allows the coordinator to mark one or more teachers absent.
- Finds teachers who are free in the required period.
- Suggests substitutions using a balanced allocation.
- Prevents the same teacher from being assigned to two classes in the same period.
- Limits automatic suggestions to two substitutions per teacher in one run.
- Allows the coordinator to manually override any suggestion.
- Saves completed substitution runs in History.
- Prints a daily substitution sheet with periods, times, classes, subjects, rooms, and
  signature spaces.

## Starting S.W.A.P. on Windows

The client needs Python installed and the project dependencies installed once.

From the project folder, run:

```powershell
cd frontend
npm install
npm run build

cd ..\backend
python -m venv venv
venv\Scripts\pip.exe install -r requirements.txt
```

After the one-time setup, double-click:

```text
backend\start_classcover.bat
```

The browser opens S.W.A.P. at:

```text
http://127.0.0.1:8000
```

If the browser does not open automatically, open that address manually. Keep the server
window running while using the application. Close it when the school day is finished.

## Starting S.W.A.P. on Mac

From the project folder, install the Python dependencies once:

```bash
cd frontend
npm install
npm run build

cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
chmod +x start_classcover.command
```

After setup, double-click `backend/start_classcover.command`. It starts the local server
and opens:

```text
http://127.0.0.1:8000
```

## First-time timetable setup

Open **Timetables** and upload the files one at a time.

### Faculty timetable

Use the **Faculty Timetable** card for teacher schedules. For two sections, upload both
files to the same card:

1. Upload the ICSE teachers' timetable.
2. Wait for the upload to show **success**.
3. Upload the ISC teachers' timetable.

### Student class-wise timetable

Use the **Student Class-wise Timetable** card for the timetable showing what each class
or section is studying. For two sections, upload both files to the same card:

1. Upload the ICSE class-wise timetable.
2. Wait for the upload to show **success**.
3. Upload the ISC class-wise timetable.

Upload each file separately. Do not press Reset between uploads. S.W.A.P. combines all
successful uploads, so the second section does not remove the first section. Multiple
classes, such as `1A`, `8C`, `10E`, `11A`, and `12B`, are supported.

The parser supports ordinary table PDFs and aSc timetable exports. Teacher initials in
aSc files are kept as they appear in the timetable, for example `IC`, `KSD`, or `KK`.
Breaks and prayer periods are ignored. A successful upload shows the number of imported
rows in the upload history.

If an upload fails, check that the file is a PDF exported with selectable text and that
it contains numbered periods and named days. Scanned image PDFs may need to be exported
again from the timetable system.

## Daily substitution process

1. Open the **Dashboard**. The greeting changes automatically according to the time of day.
2. In **Mark absent teachers**, search for and select every teacher who is absent.
3. Select **Generate Substitution**.
4. Review every class that needs cover. Each row shows the period, time, class, subject,
   absent teacher, available substitute choices, and room.
5. Change a suggested teacher when the coordinator knows that person has a meeting,
   exam duty, or another responsibility.
6. Leave a row unassigned when no suitable teacher is available.
7. Select **Confirm & Save** when the list is correct.

Suggestions are balanced so the automatic process does not assign more than two classes
to the same teacher in one substitution run. The coordinator can still manually choose
an available teacher for an individual row when school circumstances require it.

S.W.A.P. also prevents one teacher from being assigned to two simultaneous classes in
the same period during the review process.

## Printing the substitution timetable

After selecting **Confirm & Save** on the Dashboard:

1. Select **Print** or **Export as PDF**.
2. Choose a printer, or choose **Save as PDF** in the browser print window.
3. Give the printed sheet to the relevant staff.

The print sheet includes the date, absent teachers, period and time, class, subject,
absent teacher, substitute teacher, room, a teacher signature column, and coordinator and
principal signature lines.

Previously saved runs can be printed from **History**. Select a date and choose **Print
substitution sheet**.

## History

**History** keeps a record of completed substitution runs. It can be used to:

- Review which teachers were absent on a previous date.
- Check which classes needed cover.
- See the substitute, period, time, subject, and room used.
- Reprint an earlier substitution sheet.
- Filter records between two dates.

History is not created until the coordinator selects **Confirm & Save**.

## Settings

The **Settings** page stores school-wide details used by the application:

- School name
- Academic year
- Working days
- Number of periods per day
- Start and end time for each period

Period timings are used on the substitution timetable and printed sheet. Enter them
before the first daily substitution run so the time column is complete.

## Resetting S.W.A.P.

The **Reset S.W.A.P.** section in Settings is a permanent clean-start option. It deletes:

- School settings
- Uploaded timetable files
- Upload history
- Teachers and classes
- Stored timetable rows
- Substitution history
- Local backup archives

S.W.A.P. asks for confirmation and requires the coordinator to type `RESET`. Use this
only when starting again from scratch. Afterward, upload the faculty and class-wise
timetables again and re-enter the school settings.

## Backups

Backups protect the local database and uploaded timetable files. From the project folder,
run:

```bash
python backend/backup_classcover.py
```

On systems where Python 3 is named `python3`, use:

```bash
python3 backend/backup_classcover.py
```

Each backup is saved under `backend/backups/` in a timestamped folder. The script keeps
the 30 most recent backups and removes older ones automatically.

For regular protection, schedule the command once per day:

- **Windows:** create a daily task in Task Scheduler that runs
  `python backend/backup_classcover.py` with the project folder as its working directory.
- **Mac:** add a daily cron entry, adjusting the project path:
  `0 17 * * * cd /path/to/SWAP && python3 backend/backup_classcover.py`

Copy important backup folders to a separate USB drive or school-approved storage. Do not
store the only copy on the same laptop.

## Troubleshooting

### The page does not open

Confirm that the launcher is running and open `http://127.0.0.1:8000` manually. If the
server window shows that port 8000 is already in use, close the other S.W.A.P. server
window first.

### The latest UI changes are not visible

Stop and restart the launcher, then refresh the browser with `Ctrl + F5` on Windows or
`Cmd + Shift + R` on Mac.

### A timetable stays in the processing or failed state

Wait for the parsing message to finish. If it fails, confirm that the file is a readable
PDF exported from the timetable system, then try the upload again. Keep the original PDF
until the upload shows **success**.

### The wrong timetable is displayed

Check the upload history and confirm that both the ICSE and ISC faculty files, and both
class-wise files where applicable, show **success**. Do not use Reset unless all stored
data should be removed.

### The time column is blank

Open Settings and enter the start and end time for each period, then save the changes.

## Privacy and scope

S.W.A.P. is designed for one school laptop and one local coordinator. It is not a
networked multi-user service. The current version does not include teacher logins,
notifications, leave management, analytics, or cloud deployment.

Built by CORE Technologies.
