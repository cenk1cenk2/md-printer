---
dest: ./test/cv-output.pdf
template: cv

name: Jane Doe
suffix: MSc.
title: Platform Engineer
tagline:
  - Engineer by trade
photo: ./assets/landscape.svg
---

::section{title="Contact Information" icon="contact"}

::::details
::detail{label="Address" value="Example Street 1, 1010 Vienna, Austria"}

:::pair
::detail{label="E-Mail" value="jane@example.com" href="mailto:jane@example.com"}

::detail{label="Web Site" value="https://example.com" href="https://example.com"}
:::
::::

::section{title="Work Experience" icon="work"}

:::entry{start="March 2024" end="present" name="Example Corp" location="Vienna, Austria" role="Platform Engineer" type="Full-Time" note="Remote" website="https://example.com"}
Building the platform other engineers ship on.

- Writing operators.
:::

::section{title="Teaching Experience" icon="teaching"}

::::group{name="Example School" location="Vienna, Austria" role="Lecturer"}
:::course{start="June 2022" duration="1 day" type="Freelance"}
- Docker Basics
:::
::::

::section{title="Education" icon="education"}

:::entry{start="2010" end="2015" name="Example University" role="Engineering" type="Bachelor's Degree" compact}
:::

::section{title="Skills" icon="skills"}

::skill{name="Languages" items="Go | TypeScript, JavaScript | Rust*"}

:::note
Items marked with \* are rusty.
:::

::section{title="Languages" icon="languages"}

:::languages
::language{name="English" level="Fluent"}

::language{name="German" level="Basic"}
:::
