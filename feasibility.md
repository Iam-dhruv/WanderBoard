# Feasibility Study Report

**Institution:** Indian Institute of Technology Roorkee
**Course:** Software Engineering, CSC 206
**Group:** 9
**Assignment:** 4

## Contributions:
* **Bhoomika:** Structured and documented the Expected Software Lifecycle and Timeline using the Evolutionary Development Model.
* **Dakshata:** Drafted the problem statement and structured the preliminary, technical, and non-functional requirements for the project.
* **Dhruv:** Drafted the unique customer personas and their possible pain points along with deciding on the means of communication between developers and with customers.
* **Garima:** Analyzed the risks associated with the project and figured out how to address them in order to have a successful project.
* **Keshav:** Identified suitable frontend and backend frameworks for developing the software and the APIs to be used.
* **Naivadhya:** Analysed the project specifications and requirements, and identified the required deliverables.

## The Customer
### Target Market and User Personas
Since WanderBoard is a consumer product rather than being custom software for a corporate client, our target customer is a group of four excited friends planning a holiday. This scenario exemplifies the chaotic dynamics our system is intended to solve, rather than the structured needs of corporate clients. Because this customer group represents a wide demographic, we have created four different user personas:

* **The Lead Planner:** This user is responsible for evaluating the viability of suggested holiday destinations and finalizing the travel plans, accommodations, and bookings. This user requires Role-Based Access Control to allow joint input while limiting the ability to change the official timeline to the Lead Planner. The Lead Planner also uses the Environmental Data Dashboard to review weather warnings before finalising travel plans.
* **The Photographer:** Primarily concerned with taking pictures of local scenery, this user highlights the importance of the Environmental Data Dashboard and Smart Contingency Flagging. The system should offer exact sunrise and sunset times to maximize opportunities for "golden hour" photography and automatically notify the group if outdoor photography plans are contradicted by forecasted rain.
* **The Experience Seeker:** This user is interested in experiencing local culture beyond the usual tourist sites. This user requires a Smart Discovery Engine to facilitate active searching for time-sensitive activities such as live music or street food. The user should also be able to add selections to the group's shared Bucket List for voting.
* **The Pragmatist:** This user is responsible for the group's budget and overall organization. This user requires an Integrated Expense Tracker to track expenses, facilitate dynamic bill splitting, and calculate simplified settlement balances to reduce post-trip accounting complexities.

## Visibility Plan
Because we are utilizing an Evolutionary Development Model, our visibility plan integrates user feedback into short development iterations. Since we do not have a dedicated external testing group, we will rely on our team members adopting different personas during testing phases, while also gathering broader validation from users outside our team through survey forms.

### Phased Internal Acceptance Testing
Visibility is tied directly to our iteration milestones, where team members will role-play specific personas to test functionality.
* **After Week 1 (MVP):** All team members will test the basic collaborative "Bucket List" and workspace creation.
* **After Week 2 (Discovery & Data):** Developers assigned to the Photographer and Experience Seeker personas will conduct scenario-based testing on the mapping and weather integrations.
* **After Week 3 (Logistics):** The team member acting as the Pragmatist will rigorously test the expense-splitting algorithm for accuracy.
* **After Week 4 (Access Control):** The assigned Lead Planner will test the final timeline creation and role enforcement.

### Requirement Evolution via Surveys
To ensure we are not developing in an echo chamber, we will circulate brief surveys to peers at key milestones to gather external ideas and validate our assumptions. We will hold internal review sessions at the end of every iteration to analyze these survey responses alongside our own testing notes. If a friction point is identified, we will evaluate the complexity of the fix. If it fits within our timeline, it will be added to the backlog for the next iteration. This approach ensures the final product resolves the real-world friction of collaborative travel planning.

## Internal Team Communication
In order to keep all six of our developers aligned without becoming bogged down in the process, the following simple rules will be employed for team coordination:
* **Digital Workspaces:** We will use a Slack server for maintaining communication. We will create separate channels for each feature group, such as UI/UX, Backend, and Expense Algorithm. This will keep the conversations organized and focused within each feature area.
* **Regular Syncs:** We will hold frequent meetings weekly, which will be used to discuss any issues faced while coding and the progress made toward the next iteration milestone.
* **Code Integration Protocols:** To avoid issues arising from contributions from different developers, all code will be pushed to a Git server. We will employ strict branch protection rules so that untested code is not merged into the main branch until the iteration is reviewed.

## Problem Statement And Requirements
Our task is to develop a collaborative, role-based travel planning and discovery platform that streamlines the group vacation experience. WanderBoard will provide a unified system that will actively help users discover local activities, share their ideas, and finalize plans using a centralized decision-making system while using context-aware travel data.

### Preliminary Requirements
1. **Active Discovery:** The platform will serve as an active discovery agent, allowing users to explore local dining, events, and landmarks tailored to specific dates and destinations.
2. **Collaboration and Polling:** A collaborative workspace will be created where users can invite friends for a new trip and maintain a shared "bucket list" for all group members to save discoveries, pitch ideas, and upvote their favourite activities.
3. **Data Aggregation:** The dashboard will aggregate critical destination data, specifically localized weather forecasts, precise sunrise/sunset times, local news and comparative hotel prices.
4. **Role-Based Access Control:** System will enforce permission tiers, empowering the "Trip Owner" with the exclusive ability to finalize the schedule by moving items into the official timeline.
5. **Financial Tracking:** It must include an integrated expense tracking module to manage shared finances, log costs, apply custom split ratios, and calculate simplified settlement balances to resolve group debts.
6. **Smart Contingency Flagging:** The platform automatically detect conflicts and suggest alternatives. For instance, suggesting indoor alternatives instead of a scheduled outdoor hike due to forecasted rain.

### Technical Requirements
1. **User Authentication and Permission Logic:** To design and implement distinct user permission tiers.
2. **Database and State Management:** To manage multi-user data interactions in a shared workspace.
3. **Frontend:** The UI/UX should support collapsable tabs, map viewing and voting buttons along with other things, so we need to use dynamic tools to ensure real-time updating. Languages like HTML, CSS and JavaScript will be used to create the base of the website. Tools like React.js may be used to implement collapsable sidebars and voting system. Bootstrap, Tailwind or other similar tools may be used for implementing the UI framework.
4. **Backend:** The software needs to handle user authentication. Hence, the backend needs a suitable framework to store usernames and passwords. Firebase, a Backend-as-a-Service by Google can be used to handle the task. It provides a NoSQL framework to store data of a user. The free plan provided should be adequate to build and test the software at a small scale. Alternatively, custom SQLite database can be connected to a Flask framework using Python.
5. **API Integrations:** Map rendering, tourist place information and real-time weather analysis require multiple API calls of different types. Many sources provide free API calls up to a limit, which is enough for testing and displaying the software on a small scale. Open Weather Map API can be used for weather information, and Places and Maps API provided by Google can be used to render maps and recommend famous tourist places in the selected region.
6. **Algorithmic Development:** For the debt-simplification process used in the expense tracker.
7. To maintain feasibility, the system will exclude automated geographic transit routing, live payment gateways, and real-time ride-hailing integrations.

### Non-Functional Requirements
1. The system should provide fast response times, with most actions completing within 2-3 seconds.
2. The platform should support small groups (for example, up to 20 members) collaborating simultaneously within a shared workspace.
3. The user interface should be simple and intuitive.
4. The system must enforce authentication and role-based permissions and store all data in a persistent database.

## Suggested Deliverables
The project will conclude with a series of artifacts that validate the system's ability to resolve group planning friction through technical rigor and user-centric design.

### Documentation Deliverables
* **Software Requirements Specification (SRS):** A comprehensive guide detailing functional requirements (Discovery, RBAC, Expense Tracking, State management) and non-functional constraints (Latency, Concurrency) which will provide a base for system design and documentations.
* **System Architecture and Design Document:** UI/UX wireframes for collaborative usage along with technical blueprints for multi-user synchronization.
* **API Integration Manual:** Documentation regarding the external data streams that provided the weather forecast, hotel pricing, and geographical mapping etc. along with their implementation and normalisation.

### Technical Deliverables
* **RBAC Tier Implementation:** Backend logic module along with secure logins that differs the core "Planner", "Photographer", "Trip Owner" and "Members" thus providing access based write permissions.
* **Debt-Simplification Engine:** A robust algorithmic implementation that minimize the number of transactions for debt settling.
* **Real-Time State Management:** A technical framework to handle simultaneous data interactions, ensuring that when one user adds an item to the "Bucket List", it updates for all group members instantly and handling any synchronization issues therein.
* **Data Normalization Layer:** This will standardize the data from various API and datasets for it to be useful in decision and providing adequate results with transparency.

### Software Deliverables
* **WanderBoard Collaborative Workspace:** The core web/mobile will include the "Bucketlist", voting area and the finalized Trip Timeline.
* **Context-Aware Dashboard:** Live interface to be provided for "Photographers" or "Trip Leader" in order to check on weather conditions and therefore replanning the trip and getting a sight of the "Golden Hour" and "Sunset Timings" etc.
* **Integrated Expense Tracker:** A functional module that balances expenses in least possible transactions computationally possible.
* **Smart Contingency Engine:** An automated notification system that flags potential scheduling conflicts based on external data alerts.

## Future Roadmap: Potential Evolutionary AI Integration
While not within the primary project scope, we may explore an Evolutionary AI Roadmap to transition WanderBoard from a passive tool to an active planner. This potential phase includes:
* **Context-Aware Initial Itineraries:** We are currently working on the possibilities of AI integration allowing us to give an initial base itinerary. This would be automatically generated based on weather conditions, providing a "Smart Start" for the group to modify.
* **AI-Customized Discovery Cards:** The system will generate initial trip suggestions based on specific themes initially provided by the user, such as "Adventurous," "Cultural," or "Budget-Pragmatic."

## Expected Software Lifecycle: Evolutionary Development Model
For developing WanderBoard, we will adopt the Evolutionary Software Development Model. Using this model, the platform will be developed through multiple iterations instead of building the entire system in a single step. Each iteration will introduce new features and improve the functionality of the previous version. This approach is suitable for our project because WanderBoard consists of several modules and relies on external APIs such as maps, weather data, and hotel pricing information. By developing the system incrementally, we can test these integrations early and reduce potential technical risks. Due to the time constraint we will be working with a time box of 1 week.

* **Week 1: Foundation and Minimum Viable Product (MVP)**
  In the first week we focus on establishing the basic infrastructure required for collaborative trip planning. Features implemented: 
  * Secure user authentication and login 
  * Shared trip workspaces for collaborative planning 
  * A collaborative Bucket List where users can suggest activities and vote on them 
  
  At the end of this week, we will verify that users are able to create trips, invite friends, and collaborate within the shared workspace. We will also ensure that common actions take approximately 2-3 seconds. 

* **Week 2: Discovery and Environmental Data Integration**
  The second iteration focuses on integrating external data sources to enrich the trip planning experience. Features implemented: 
  * Integration of a mapping API to display points of interest and activity locations 
  * Integration of environmental data such as weather forecasts and sunrise/sunset timings 
  * Basic discovery features to help users find activities in their destination 
  
  Testing in this stage will verify that external data is fetched correctly and displayed properly within the platform. 

* **Week 3: Logistics and Smart Planning Features**
  In the third iteration, more advanced planning and financial management tools will be implemented. Features implemented: 
  * Expense management system with a debt simplification algorithm 
  * Smart Contingency Flagging to warn users of potential weather disruptions 
  
  Testing during this stage will focus on verifying the correctness of expense calculations and the proper functioning of weather-related alerts. 

* **Week 4: Access Control and Plan Finalization**
  This iteration focuses on completing the collaborative planning workflow by introducing access control and plan finalization features. Features implemented: 
  * Role-Based Access Control (RBAC) to make sure that only authorized users can perform specific actions. 
  * Ability for the Trip Owner to finalize the itinerary by moving selected activities into the trip timeline 
  
  Integration testing will ensure that finalized plans are synchronized correctly across all users in the shared workspace. 

* **Week 5: System Refinement and Project Completion**
  The final iteration focuses on stabilizing the system and preparing the project for submission. Activities include: 
  * Fixing remaining bugs and optimizing performance 
  * Improving the user interface and overall usability 
  * Finalizing project documentation and organizing the source code for submission 
  
  This final stage ensures that the system is stable, functional, and aligned with the project requirements before submission. 

## Risk Analysis
Every project has its own set of risks irrespective of the amount of planning. Below we have tried to think honestly about what could go wrong with WanderBoard and what we plan to do about it.

* **Third-Party API Unreliability (Severity: High)**
  WanderBoard's core features: weather data, sunrise/sunset timings, hotel pricing, and maps, all depend on external APIs that we do not control. These services can change their pricing plans, enforce stricter rate limits, or simply go down without warning. If our weather API starts returning errors, several features of the platform break entirely, not just one. 
  *How we plan to handle it:* We will identify at least one fallback API for each critical integration (for example, Open-Meteo as a backup to OpenWeatherMap). Additionally, the integration testing in Week 2 is specifically timed early so that API issues can be solved at the earliest. We will also cache recent API responses locally so the UI does not completely break during brief outages. 

* **Real-Time Synchronization Complexity (Severity: High)**
  One of WanderBoard's most appealing features is that when one user adds an item to the Bucket List, every other group member sees it immediately. In theory this sounds simple. But in practice, handling simultaneous edits, such as two users voting on the same item at the same time, or the Trip Owner finalizing the timeline while another member is still editing are tricky to get right. Race conditions and inconsistent data are subtle bugs are hard to fix under time pressure. 
  *How we plan to handle it:* We will address this in Iteration 3 by using a managed backend service (such as Firebase Realtime Database or Supabase) that handles conflict resolution out of the box, rather than building our own synchronization logic from scratch. Integration testing at the end of Iteration 4 will specifically simulate multiple users acting simultaneously. 

* **Scope Creep from Feature Ideas (Severity: Medium)**
  WanderBoard is an exciting project and the possible features it can have are endless. As we build and demo each iteration, team members and survey respondents will inevitably suggest new features like AI itinerary generation, live chat, transport booking, and so on. Each of these sounds reasonable in isolation, but saying yes to too many additions mid-project means the core features never get finished properly. 
  *How we plan to handle it:* We have explicitly defined out-of-scope items in the proposal (no live payment gateways, no real-time ride-hailing). The AI itinerary feature is labeled as optional and will only be attempted during Iteration 5 if all core features are stable. Any new idea raised in a survey will be logged in a backlog but will only be included if it fits within the remaining timeline without disrupting existing work. 

* **Debt-Simplification Algorithm Correctness (Severity: Medium)**
  The expense tracker is not just a list of who paid what but it must compute the minimum number of transactions needed to settle all debts within the group. This is an algorithmic problem. One error in the settlement logic means users get incorrect balances and finance related bugs should be handled wisely with utmost care so that chances of error are almost zero. 
  *How we plan to handle it:* This module will be isolated and unit tested exhaustively with hand-calculated test cases before it is integrated into the platform. The team member assigned to this task during Iteration 3 testing will run through at least ten different expense scenarios: equal splits, custom ratios, partial payments and verify each result manually. 

* **User Authentication and Data Security (Severity: Medium)**
  WanderBoard stores personal trip data, group membership, and financial records. If authentication is implemented carelessly, the system could expose one user's data to another, or be vulnerable to basic attacks like SQL injection. 
  *How we plan to handle it:* We will use an established authentication library rather than rolling our own (for example, Firebase Auth or Supabase Auth). Basic security checks will also be done to make the application secure. 

* **Testing Without a Dedicated External User Group (Severity: Low)**
  Our visibility plan relies on team members role-playing personas during testing. The problem is that we know how the system is supposed to work, which means we unconsciously avoid the actions a real user might take like clicking buttons in an unexpected order or entering edge-case inputs. This creates a blind spot where bugs that would be obvious to an outsider go unnoticed until submission. 
  *How we plan to handle it:* We will circulate survey forms to our classmates outside our team at the end of each iteration and specifically ask them to try to break things rather than just evaluate the design. This will help us to truly design a bug-free application tested with actual people. 

### Table 1: Risk Summary for WanderBoard

| Risk | Severity | Likelihood | Primary Mitigation |
| :--- | :--- | :--- | :--- |
| API Unreliability | High | High | Fallback APIs + early integration testing |
| Real-Time Sync Bugs | High | Medium | Use managed backend service |
| Scope Creep | Medium | High | Locked backlog + optional feature policy |
| Expense Algorithm Bugs | Medium | Medium | Isolated unit testing with manual cases |
| Security Vulnerabilities | Medium | Low | Auth library + security checks on input |
| Testing Blind Spots | Low | High | External peer surveys each iteration |

Overall, the risks associated with WanderBoard are manageable. The most critical ones are tied to external dependencies which we have tried to address structurally through our iterative development plan rather than leaving them as things to "figure out later."