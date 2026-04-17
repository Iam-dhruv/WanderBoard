# Software Requirements Specification (SRS)

**Institution:** Indian Institute of Technology Roorkee
**Course:** Software Engineering, CSC 206
**Group - 9**
**Assignment - 5**

## Contributions:
* **Bhoomika:** Documented the Technical Requirements and Architecture components for Design document.
* **Dakshata:** Structured the Non-Functional Requirements including performance and concurrency metrics.
* **Dhruv:** Drafted the Target Audience and User Personas to define system constraints.
* **Garima:** Compiled the Functional Requirements and provided the Acceptance Criteria along with brainstorming the system test cases.
* **Keshav:** Studied the current market competitors and analysed points of differentiation of the software.
* **Naivadhya:** Studied the functional requirements and provided a base structure for the same.

## Project Abstract
WanderBoard is a collaborative, role-based travel discovery and planning platform designed to streamline the chaotic process of group vacation planning. The software provides a unified dashboard that actively helps users discover local activities, democratizes idea-sharing through a shared bucket list, and centralizes decision-making with context-aware travel data such as localized weather and comparative hotel prices.

## Customer
The general customer base for this software consists of groups of friends or families who wish to plan joint vacations but struggle with the fragmented, stressful nature of juggling multiple browser tabs, group chats, and unstructured data. Our dummy customer represents a group of four enthusiastic friends planning a holiday together. This group showcases the chaos of trip planning our system is going to resolve and inspires the requirements specified in this document. To ensure all stakeholder viewpoints are taken into account and to provide clear reasoning for our system's functions, this dummy customer group is modeled into four distinct user personas:
* **The Lead Planner:** She takes on the responsibility of evaluating the feasibility of proposed locations and finalizing the actual schedule. Her viewpoint necessitates Role-Based Access Control, ensuring that while everyone can share ideas, only she has the authority to lock items into the official timeline. She also requires environmental data to ensure plans are safe and practical.
* **The Photographer:** Highly focused on capturing local landscapes, his needs justify the Environmental Data Dashboard and Smart Contingency Flagging. He requires the system to track exact sunrise and sunset times to catch the "golden hour" and automatically warn the group if an outdoor shoot conflicts with forecasted rain.
* **The Experience Seeker:** Looking to explore the city's culture beyond typical tourist traps, he drives the requirement for the Smart Discovery Engine. He needs to actively search for dynamic, time-sensitive activities (like live music or street food) and drop them into the group's shared bucket list for voting.
* **The Pragmatist:** Responsible for managing the group's overall budget and logistics, she highlights the need for an Integrated Expense Tracker. Her viewpoint requires the platform to seamlessly log shared costs, split bills dynamically, and calculate simplified settlement balances to avoid awkward post-trip accounting.

These personas are neither exclusive or exhaustive but they give an overall view of the major pain points we are targetting with this project.

## Competitive Landscape
### Market overview and competitors
The current market for trip planners has a variety of options, ranging from itinerary builders like Tripit and Wanderlog to discovery sites like Tripadvisor. Payment settlement software like Splitwise is also well-known. Each of these softwares is well developed in their own niche, but the integration of their functionality is missing.

### Competitors Strength and Weakness
* **Strengths:** The existing competitors are very sound on their core functionality. They offer clean and intuitive UI to the customer and have established themselves firmly in their own niche.
* **Weakness:** Many of the individual functionalities provided by the competition are usually required together while planning trips. Moreover, most of the softwares don't allow collaboration on trip planning across multiple travellers. But planning a trip individually when there are others involved is not useful as there has to be discussion and finalization of places to visit during the trip amongst all the travellers.

### Competitive differentiation
* **Collaborative Workspace:** Wanderboard allows users to share their preferred places to visit and others to share their opinion about it. This simulates real trips more closely, as usually the places visited during the trips are the ones that most of the travellers support.
* **Role-based access control:** Wanderboard assigns roles to all the travellers to ensure there is no confusion amongst the travellers. It allows for hassle-free travel, as each traveller is aware of his/her responsibilities.
* **Smart contingency flagging:** Wanderboard takes into consideration the weather of a particular day and notifies the users of potential clashes. It saves the travellers time of vetting each day carefully and saves them from unexpected weather changes that might spoil the trip.
* **Integrated expense tracker:** Not everyone splits the bill while paying every time. An integrated expense tracker allows travellers to add expenses they made on behalf of others and allows them to track expenses at every step of the trip. This feature is not offered by other itinerary planners.
* **Context-aware feature integration:** Wanderboard saves the hassle of switching across multiple apps to manage the trip and offers a one-stop solution for travel groups to efficiently manage the trips by providing all the necessities in a single software.

### Table 1: Competitor Feature Matrix
| Core Feature / Requirement | WanderBoard (Proposed) | Wanderlog | Stippl | Standalone Expense Apps (e.g., Splitwise) |
| :--- | :--- | :--- | :--- | :--- |
| Unified Collaborative Workspace (Bucket List & Voting) | Yes | Partial (No voting) | Partial (No voting) | No |
| Role-Based Access Control (Trip Owner Finalization) | Yes | No (All editors equal) | No (All editors equal) | No |
| Context-Aware Environmental Data (Weather, Sunsets) | Yes | Partial (Basic weather) | Partial (Basic weather) | Yes (Core function) |
| Smart Contingency Flagging (Weather Conflicts) | Yes | No | No | No |
| Integrated Expense Tracker & Settlement Math | Yes | Yes | Yes | No |

## System Requirements
System requirements refer to the core behaviors of WanderBoard. Each requirement is mapped to a functional module and has been assigned a priority (Must Have, Useful, Optional), along with providing a formal Acceptance Criteria and a real-world test case.

### Functional Use Cases

#### Use Case-1: User Auth & Workspace Management
* **Requirement 1: Secure Authentication [Priority: Must Have]**
  Support user registration and login via Firebase Auth (Google/Email).
  * **Acceptance Criteria:** User is redirected to the dashboard upon valid login and a error is shown in case of invalid attempts.
  * **Test Case:** User enters "student@cs.utr.ac.in" with an incorrect password.
  * **Result:** System displays "Invalid Credentials" and prevents dashboard access.
* **Requirement 2: Trip Creation & Invite System [Priority: Must Have]**
  Users shall create workspaces and invite members via a 6-digit alphanumeric code.
  * **Acceptance Criteria:** Entering a valid code adds the user to the trip instantly. Test Case: Lead Planner generates code "XJ92L1". Peer user enters this code on their device.
  * **Result:** The peer user's name immediately appears in the "Current Travelers" list on both devices.
* **Requirement 3: Role-Based Access Control [Priority: Must Have]**
  Designate the creator as "Trip Owner" with exclusive write-access to the timeline.
  * **Acceptance Criteria:** Timeline modifications by non-owners must be blocked.
  * **Test Case:** A Photographer (Member) tries to drag an activity from the Bucket list to the Tuesday Timeline.
  * **Result:** The item snaps back to the backet list with an alert notification: "Only the Lead Planner can finalize dates."

#### Use Case-2: Collaborative Planning
* **Requirement 1: Suggestion Engine [Priority: Must Have]**
  Members can add activities to the Bucket List via search tool.
  * **Acceptance Criteria:** Suggestions added must be visible to all members within the team.
  * **Test Case:** User A adds "Ganga Aarti, Haridwar" to the Bucket List.
  * **Result:** User B sees this card appear in their app immediately.
* **Requirement 2: Discovery Integration [Priority: Useful]**
  The system shall integrate Google Places API to recommend landmarks and provide location metadata.
  * **Acceptance Criteria:** Search results must include name, rating, and address before they are added to the Bucket List.
  * **Test Case:** User searches "Brahma Kund".
  * **Result:** A card is generated containing the place's 4.8-star rating and a thumbnail image fetched via API.
* **Requirement 3: Real-time Voting [Priority: Useful]**
  Members can upvote/downvote entries to indicate their preference.
  * **Acceptance Criteria:** UI must reflect vote changes dynamically.
  * **Test Case:** Three members click the "Heart" icon on a "Rishikesh Rafting" card.
  * **Result:** The vote counter on everyone's screen increments from 0 to 3 in real-time.

#### Use Case-3: Environmental Intelligence Dashboard
* **Requirement 1: Display Correct Weather Data [Priority: Useful]**
  Display Sunrise/Sunset times based on destination coordinates.
  * **Acceptance Criteria:** Solar times update automatically upon destination change.
  * **Test Case:** User changes trip from "Roorkee" to "Iceland".
  * **Result:** The dashboard sunset time shifts from 6:30 PM to 11:45 PM based on the new GPS coordinates.
* **Requirement 2: Weather Flagging [Priority: Must Have]**
  Flag outdoor activities if forecasted precipitation exceeds 20%.
  * **Acceptance Criteria:** A red warning icon appears on the activity card.
  * **Test Case:** A "Mountaineering" activity is scheduled for Friday. But OpenWeatherMap API reports a 40% rain chance.
  * **Result:** A red blinking alert icon appears on Friday's timeline saying "Rain Predicted: Outdoor Hazard."

#### Use Case-4: Expense Tracker & Debt Settlement
* **Requirement 1: Flexible Split Logic [Priority: Must Have]**
  The system shall support equal, percentage-based, and fixed amount split ratios for any logged expense.
  * **Acceptance Criteria:** The sum of all splits must equal the total transaction amount before the record can be added.
  * **Test Case:** User logs a Rs.120 dinner. Sets User A to pay 50%, User B Rs.40, and User C Rs.20.
  * **Result:** System validates sum and allows the entry.
* **Requirement 2: Settlement Algorithm [Priority: Useful]**
  Minimize transactions using a greedy algorithm (Debt Chaining).
  * **Acceptance Criteria:** Transaction count never exceeds N-1 for a group of N people.
  * **Test Case:** User A owes User B Rs.50. User B owes User C Rs.50.
  * **Result:** System skips User B and shows: "User A owes User C Rs.50."
* **Requirement 3: Manual Reconciliation [Priority: Must Have]**
  Allow users to mark a debt as "Settled" manually.
  * **Acceptance Criteria:** Balance ledger zeroes out immediately for both parties.
  * **Test Case:** User A ows User C Rs.50 cash and clicks "Settled" on the app.
  * **Result:** User A's debt list clears, and User C's receivable dashboard updates to Rs.50.

#### Use Case-5: AI Itinerary Generation
* **Requirement 1: Automated Starter Itinerary [Priority: Optional]**
  The Trip Owner requests an editable starter itinerary automatically generated from the destination, dates, and weather.
  * **Acceptance Criteria:** An editable draft timeline populates within 10 seconds of the request.
  * **Test Case:** Trip Owner clicks "Generate AI Itinerary" for a 3-day trip to "Manali" in December.
  * **Result:** A structured timeline appears within 8 seconds, including weather-appropriate activities (e.g., skiing, cafe hopping) mapped to the selected dates.
* **Requirement 2: AI-Driven Activity Suggestions [Priority: Must Try]**
  The system shall generate a set of activity "cards" based on the destination and traveler profile for initial sandbox selection.
  * **Acceptance Criteria:** Users can tap on suggested cards to add them to the Bucket List for future timeline planning.
  * **Test Case:** User selects "Adventure" and "Nature" as trip tags for a Goa trip.
  * **Result:** A horizontal scroll of cards including "Scuba Diving at Grande Island" and "Dudhsagar Falls Trek" appears; clicking "Add" moves them to the Sandbox.

### Non-Functional Requirements
* **Performance:** All user-initiated actions must complete and reflect on screen within 2-3 seconds under normal network conditions.
* **Concurrency:** Up to 20 members must be able to work in the same shared workspace simultaneously without data loss or conflicts.
* **Security:** Role-based permissions must be enforced at the data-storage level, not just in the interface. A Trip Member must not be able to modify the official timeline even through direct system access. All trip data must be accessible only to authenticated members of that trip.
* **Persistence:** All trip data must survive page refreshes and browser restarts. No action should silently fail without an error message.
* **Reliability:** There must be a fallback for each data source to prevent a single source from disabling critical system functionality.
* **Data Capacity:** Each account must support at least 20 trips. Each trip must support at least 100 Bucket List items, 500 expense entries, and a 30-day timeline.
* **Environment:** The application must run on Chrome, Firefox, Safari, and Edge (2022 releases or later) and on mobile browsers on Android 10+ and iOS 15+. No installation other than a browser is required.

### External Dependencies
The system depends on the following external components and services.
* **Environment:** A modern web browser (Chrome, Firefox, Safari, or Edge).
* **Network Requirement:** A stable internet connection is required; offline functionality is not supported.