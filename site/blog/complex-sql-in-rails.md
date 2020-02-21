---
title: Working with complex SQL statements in Rails and ActiveRecord
date: 2014-09-14
featured_image: /images/blog/complex-sql-in-rails.jpg
image_caption: Photo by Dan Meyers on Unsplash
tags:
  - blog
  - rails
---

Rails (via ActiveRecord) makes it super easy to work with your data, and for most simple tasks insulates you from having to think too hard about SQL. But eventually, everyone hits the ORM wall, and needs to start casting SQL spells around to get the data that they want. And writing SQL can really feel like that sometimes, like an incantation that you speak over your database -- and magically the data rearranges itself into the form that you need.

Take, for example, the problem of calculating a duration in business hours. Let's say we have a `Tickets` table with `opened_at` and `closed_at` timestamps. Our challenge is to calculate the total time the Ticket was open, based not on calendar time but on business hours, like 8am-5pm PST Mon-Fri. Now, you could come up with some Ruby code to calculate that for each row, but we want to do it in the database for all records. So, we are going to build an AR scope that will add an additional column called `duration`, calculated at query time.

(NOTE: This post assumes you are one of the cool kids and are using Postgres as your DB.)

To start out, let's get a duration of simple calendar time.

```ruby
# id integer
# opened_at timestamp
# closed_at timestamp
class Ticket < ActiveRecord::Base
  def self.with_calendar_duration
    select("tickets.*, (closed_at - opened_at) as duration")
  end
end
```

Now, you can say

```ruby
Ticket.with_calendar_duration
```

which will add an additional column called duration that you can access ruby as usual. Note that there is nothing you need to do in your Rails model file (no need for an attr_accessor etc) for this to happen. ActiveRecord will simply add any extra columns selected to the model automagically. (However, since Rails has no type information for the column, it thinks the Postgres interval type is a String).

```ruby
Ticket.with_calendar_duration.first.duration  #=> "10 days 11:00:00.000164"
```

So, that was easy. Now for the hard (fun) part. We need to calculate the time difference between `opened_at` and `closed_at` but taking into account only M-F and 8a-5p PDT. We are going to basically construct a raw SQL query, and take advantage of Common Table Expressions (CTEs) in Postgres, which are underused but full of awesome.

The SQL (the explanation of which I will defer until another blog post) we need is wrapped up in an AR scope:

```ruby
# id integer
# opened_at timestamp
# closed_at timestamp
class Ticket < ActiveRecord::Base
  def self.with_biz_duration
    query = <<-SQL
      WITH
        var AS (SELECT '08:00'::time as v_start, '17:00'::time as v_end)

      SELECT tickets.*,
        (date_part('epoch',
          COALESCE (h
          - CASE WHEN EXTRACT(ISODOW FROM opened_at) < 6
                  AND opened::time > v_start
                  AND opened::time < v_end THEN
               opened_at - date_trunc('hour',  opened_at)
             ELSE '0'::interval END
          + CASE WHEN EXTRACT(ISODOW FROM closed_at) < 6
                  AND closed_at::time > v_start
                  AND closed_at::time < v_end THEN
               (closed_at - date_trunc('hour', closed_at)) - interval '1h'
            ELSE '0'::interval END
          , '0'::interval)
        )/60)::integer AS duration --minutes
      FROM  (tickets CROSS JOIN var)
      LEFT JOIN  (
        SELECT sub1.id, count(*)::int * interval '1h' AS h
        FROM  (
          SELECT id, v_start, v_end
                ,generate_series (date_trunc('hour', opened_at)
                                , date_trunc('hour', closed_at)
                                , interval '1h') AS h
          FROM   tickets, var
          ) sub1
        WHERE  EXTRACT(ISODOW FROM h) < 6
        AND    h::time >= v_start
        AND    h::time <  v_end
        GROUP  BY 1
      ) sub2 USING (id)
    SQL

    self.find_by_sql(query)
  end
end
```

So, now we can say

```ruby
Ticket.with_biz_duration.map(&:duration)  #=>  [4760, 2700, 3320, 15980, 13500]
```

But, this 'scope' is not really an AR scope, as it does not return a chainable AR Relation. So you have to always use it at the end of the chain. But the way it currently stands, the query doesn't know anything about any existing relations, so this won't work

```ruby
Ticket.where(:something => 'else').with_biz_duration
```

It would be cool if we could capture the records in the existing scope, and only use those in our query. We can achieve this with another CTE

```ruby
# id integer
# opened_at timestamp
# closed_at timestamp
class Ticket < ActiveRecord::Base
  def self.with_biz_duration
    query = <<-SQL
      WITH
       existing_scope AS (#{existing_scope_sql}),
       tickets_scoped AS (SELECT tickets.*
                                       FROM tickets
                                       INNER JOIN existing_scope ON existing_scope.id = tickets.id),

        var AS (SELECT '08:00'::time as v_start, '17:00'::time as v_end)

      SELECT tickets_scoped.*,
        (date_part('epoch',
          COALESCE (h
          - CASE WHEN EXTRACT(ISODOW FROM opened_at) < 6
                  AND opened_at::time > v_start
                  AND opened_at::time < v_end THEN
               opened_at - date_trunc('hour',  opened_at)
             ELSE '0'::interval END
          + CASE WHEN EXTRACT(ISODOW FROM closed_at) < 6
                  AND closed_at::time > v_start
                  AND closed_at::time < v_end THEN
               (closed_at - date_trunc('hour', closed_at)) - interval '1h'
            ELSE '0'::interval END
          , '0'::interval)
        )/60)::integer AS duration --minutes
      FROM  (tickets_scoped CROSS JOIN var)
      LEFT JOIN  (
        SELECT sub1.id, count(*)::int * interval '1h' AS h
        FROM  (
          SELECT id, v_start, v_end
                ,generate_series (date_trunc('hour', opened_at)
                                , date_trunc('hour', closed_at)
                                , interval '1h') AS h
          FROM   tickets_scoped, var
          ) sub1
        WHERE  EXTRACT(ISODOW FROM h) < 6
        AND    h::time >= v_start
        AND    h::time <  v_end
        GROUP  BY 1
      ) sub2 USING (id)
    SQL

    self.find_by_sql(query)
  end

  private
  def self.existing_scope_sql
      # have to do this to get the binds interpolated. remove any ordering and just grab the ID
      self.connection.unprepared_statement {self.reorder(nil).select("id").to_sql}
   end
end
```

So we basically converted the current scope to a SQL statement, and used that as a CTE to run the query against, thus limiting the rows we are operating against. We can use other scopes or where clauses as long as we call our `with_biz_duration` scope at the end of the chain.

```ruby
Ticket.where(:id => 1).with_biz_duration.map(&:duration)  #=>  [4760]
```

Now to take it to the bitter end, let's add the ability to pass in the business hours we want, as well as the timezone.

One issue with our `tickets` table is that the `opened_at` and `closed_at` fields were created as `timestamp` fields, which in Postgres do not have any timezone information. If we assume our DB server was configured to use UTC as the default timezone, then we need to cast the fields into fields with a UTC time zone, which we then cast again into the timezone we want.

```sql
# id integer
# opened_at timestamp
# closed_at timestamp
class Ticket < ActiveRecord::Base
  def self.with_biz_duration(start_time='08:00', end_time='17:00', rails_timezone='America/Los_Angeles')
    pg_timezone = ActiveSupport::TimeZone[rails_timezone].tzinfo.name
    query = <<-SQL
      WITH
       existing_scope AS (#{existing_scope_sql}),
       tickets_scoped AS (SELECT tickets.*,
                                 (tickets.opened_at at time zone 'UTC') at time zone '#{pg_timezone}' as opened_at_tz,
                                 (tickets.closed_at at time zone 'UTC') at time zone '#{pg_timezone}' as closed_at_tz
                                       FROM tickets
                                       INNER JOIN existing_scope ON existing_scope.id = tickets.id),

        var AS (SELECT '#{start_time}'::time as v_start, '#{end_time}'::time as v_end)

      SELECT tickets_scoped.*,
        (date_part('epoch',
          COALESCE (h
          - CASE WHEN EXTRACT(ISODOW FROM opened_at_tz) < 6
                  AND opened_at_tz::time > v_start
                  AND opened_at_tz::time < v_end THEN
               opened_at_tz - date_trunc('hour',  opened_at_tz)
             ELSE '0'::interval END
          + CASE WHEN EXTRACT(ISODOW FROM closed_at_tz) < 6
                  AND closed_at_tz::time > v_start
                  AND closed_at_tz::time < v_end THEN
               (closed_at_tz - date_trunc('hour', closed_at_tz)) - interval '1h'
            ELSE '0'::interval END
          , '0'::interval)
        )/60)::integer AS duration --minutes
      FROM  (tickets_scoped CROSS JOIN var)
      LEFT JOIN  (
        SELECT sub1.id, count(*)::int * interval '1h' AS h
        FROM  (
          SELECT id, v_start, v_end
                ,generate_series (date_trunc('hour', opened_at_tz)
                                , date_trunc('hour', closed_at_tz)
                                , interval '1h') AS h
          FROM   tickets_scoped, var
          ) sub1
        WHERE  EXTRACT(ISODOW FROM h) < 6
        AND    h::time >= v_start
        AND    h::time <  v_end
        GROUP  BY 1
      ) sub2 USING (id)
    SQL

    self.find_by_sql(query)
  end

  private
  def self.existing_scope_sql
      # have to do this to get the binds interpolated. remove any ordering and just grab the ID
      self.connection.unprepared_statement {self.reorder(nil).select("id").to_sql}
   end
end

```

So, now we can say

```ruby
Ticket.where(:id => 1).with_biz_duration('01:00', '03:00', 'America/New_York').map(&:duration) #=> [960]
```

Tune in next time as we delve into the mysteries of `generate_series` and `CROSS JOIN` which are at the heart of this powerful incantation. Happy SQLing!
