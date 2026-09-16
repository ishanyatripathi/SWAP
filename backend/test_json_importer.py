import json
from pathlib import Path

from app.services.json_timetable_parser import parse_json_timetable


def _write_json(path: Path, payload):
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_parse_json_timetable_builds_slot_rows(tmp_path):
    payload = {
        "teachers": [
            {
                "teacher_id": "AED",
                "teacher_name": "AARTI DHANE (AED)",
                "timetable_grids": ["ICSE", "ISC"],
                "weekly_schedule": [
                    {
                        "day": "MON",
                        "assignments": [
                            {
                                "start": "08:15",
                                "end": "08:45",
                                "source_grid": "ISC",
                                "source_period": 1,
                                "assignment": "11B (ART) {room: AR1}",
                                "type": "real_class",
                            }
                        ],
                    }
                ],
            }
        ]
    }

    file_path = tmp_path / "teacher_timetables.json"
    _write_json(file_path, payload)

    rows = parse_json_timetable(str(file_path))

    assert rows == [
        {
            "day": "MON",
            "period": 1,
            "teacher": "AED",
            "class_name": "11B",
            "subject": "ART",
            "room": "AR1",
        }
    ]
