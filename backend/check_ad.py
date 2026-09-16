
import sqlite3
import pandas as pd

conn = sqlite3.connect('classcover.db')
query = '''
SELECT t.day, t.period, c.name as class_name, t.subject, tr.name as teacher_name
FROM timetable_slots t
JOIN teachers tr ON t.teacher_id = tr.id
JOIN classes c ON t.class_id = c.id
WHERE tr.name = 'AD'
ORDER BY t.day, t.period
'''
df = pd.read_sql_query(query, conn)
print(df.to_string())

