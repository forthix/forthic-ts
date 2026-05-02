# datetime Module

[← Back to Index](../index.md)

Date and time operations using the Temporal API for timezone-aware datetime manipulation.

**17 words**

## Categories

- **Current**: TODAY, NOW
- **Time adjustment**: AM, PM
- **Conversion to**: >TIME, >DATE, >DATETIME, AT
- **Conversion from**: TIME>STR, DATE>STR
- **Getters**: YEAR, MONTH, DAY-OF-WEEK
- **Timestamps**: >TIMESTAMP, TIMESTAMP>DATETIME
- **Date math**: ADD-DAYS, DAYS-BETWEEN

## Examples

```forthic
TODAY
NOW
"14:30" >TIME
"2024-01-15" >DATE
TODAY "14:30" >TIME AT
TODAY 7 ADD-DAYS
```

## Words

### >DATE

**Stack Effect:** `( item:any -- date:Temporal.PlainDate )`

Convert string or datetime to PlainDate

---

### >DATETIME

**Stack Effect:** `( str_or_timestamp:any -- datetime:Temporal.ZonedDateTime )`

Convert string or timestamp to ZonedDateTime

---

### >TIME

**Stack Effect:** `( item:any -- time:Temporal.PlainTime )`

Convert string or datetime to PlainTime

---

### >TIMESTAMP

**Stack Effect:** `( datetime:Temporal.ZonedDateTime -- timestamp:number )`

Convert datetime to Unix timestamp (seconds)

---

### ADD-DAYS

**Stack Effect:** `( date:Temporal.PlainDate num_days:number -- date:Temporal.PlainDate )`

Add days to a date

---

### AM

**Stack Effect:** `( time:Temporal.PlainTime -- time:Temporal.PlainTime )`

Convert time to AM (subtract 12 from hour if >= 12)

---

### AT

**Stack Effect:** `( date:Temporal.PlainDate time:Temporal.PlainTime -- datetime:Temporal.ZonedDateTime )`

Combine date and time into datetime

---

### DATE>STR

**Stack Effect:** `( date:Temporal.PlainDate -- str:string )`

Convert date to YYYY-MM-DD string

---

### DAY-OF-WEEK

**Stack Effect:** `( date:Temporal.PlainDate -- day:number )`

Get the day-of-week (1=Monday, 7=Sunday, ISO 8601).

---

### DAYS-BETWEEN

**Stack Effect:** `( date1:Temporal.PlainDate date2:Temporal.PlainDate -- num_days:number )`

Get number of days between two dates (date1 - date2)

---

### MONTH

**Stack Effect:** `( date:Temporal.PlainDate -- month:number )`

Get the calendar month of a date (1=January, 12=December).

---

### NOW

**Stack Effect:** `( -- datetime:Temporal.ZonedDateTime )`

Get current datetime

---

### PM

**Stack Effect:** `( time:Temporal.PlainTime -- time:Temporal.PlainTime )`

Convert time to PM (add 12 to hour if < 12)

---

### TIME>STR

**Stack Effect:** `( time:Temporal.PlainTime -- str:string )`

Convert time to HH:MM string

---

### TIMESTAMP>DATETIME

**Stack Effect:** `( timestamp:number -- datetime:Temporal.ZonedDateTime )`

Convert Unix timestamp (seconds) to datetime

---

### TODAY

**Stack Effect:** `( -- date:Temporal.PlainDate )`

Get current date

---

### YEAR

**Stack Effect:** `( date:Temporal.PlainDate -- year:number )`

Get the calendar year of a date.

---


[← Back to Index](../index.md)
