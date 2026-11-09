import addressCard from '@fortawesome/fontawesome-free/svgs/solid/address-card.svg'
import briefcase from '@fortawesome/fontawesome-free/svgs/solid/briefcase.svg'
import building from '@fortawesome/fontawesome-free/svgs/solid/building.svg'
import calendarDays from '@fortawesome/fontawesome-free/svgs/solid/calendar-days.svg'
import chalkboardUser from '@fortawesome/fontawesome-free/svgs/solid/chalkboard-user.svg'
import clock from '@fortawesome/fontawesome-free/svgs/solid/clock.svg'
import code from '@fortawesome/fontawesome-free/svgs/solid/code.svg'
import graduationCap from '@fortawesome/fontawesome-free/svgs/solid/graduation-cap.svg'
import houseLaptop from '@fortawesome/fontawesome-free/svgs/solid/house-laptop.svg'
import language from '@fortawesome/fontawesome-free/svgs/solid/language.svg'
import laptopCode from '@fortawesome/fontawesome-free/svgs/solid/laptop-code.svg'
import locationDot from '@fortawesome/fontawesome-free/svgs/solid/location-dot.svg'
import school from '@fortawesome/fontawesome-free/svgs/solid/school.svg'
import userGraduate from '@fortawesome/fontawesome-free/svgs/solid/user-graduate.svg'
import userTie from '@fortawesome/fontawesome-free/svgs/solid/user-tie.svg'
import user from '@fortawesome/fontawesome-free/svgs/solid/user.svg'

export const sections: Record<string, string> = {
  contact: user,
  profile: addressCard,
  work: userTie,
  teaching: chalkboardUser,
  education: graduationCap,
  skills: code,
  languages: language
}

// pills look their value up here, so a value without an entry prints as a plain pill
/* eslint-disable @typescript-eslint/naming-convention, stylistic/quotes -- keys are pill labels as written in the document, lowercased */
export const tags: Record<string, string> = {
  'full-time': briefcase,
  'part-time': briefcase,
  freelance: laptopCode,
  internship: userGraduate,
  remote: houseLaptop,
  'on-site': building,
  hybrid: building,
  "master's degree": graduationCap,
  "bachelor's degree": graduationCap,
  'high school': school,
  duration: clock,
  period: calendarDays,
  location: locationDot
}
/* eslint-enable @typescript-eslint/naming-convention, stylistic/quotes */
