// QIU Talent Feed — sample opted-in, coordinator-approved public FYP entries.
//
// These represent students who submitted their Final Year Project through the
// FYP Showcase module (components/FYPShowcase.jsx), toggled the public opt-in
// on, and had a CPDC coordinator approve the entry. Only approved + public
// entries are ever surfaced here; the feed itself filters defensively on
// `approved` so a not-yet-cleared row can never leak onto the public gallery.

export const TALENT_FEED = [
  {
    id: 'talent-1',
    studentName: 'Alex Thorne',
    facultyId: 'computing_engineering',
    programme: 'Bachelor of Computer Science (Honours)',
    gradYear: 2026,
    title: 'Edge-AI Flood Prediction for Riverine Communities',
    abstract:
      'A low-cost sensor mesh that runs a quantised LSTM directly on Raspberry Pi nodes to forecast flash floods 45 minutes ahead, alerting residents by SMS without relying on cloud connectivity.',
    tech: ['Python', 'TensorFlow Lite', 'Raspberry Pi', 'LoRa', 'MQTT'],
    badges: ['Git Master', 'AI Hackathon Winner', 'FYP Distinction'],
    approved: true,
  },
  {
    id: 'talent-2',
    studentName: 'Rachel Dupont',
    facultyId: 'business',
    programme: 'Bachelor of Finance (Honours)',
    gradYear: 2026,
    title: 'Predictive Churn Analytics for Malaysian SME Lenders',
    abstract:
      'A capstone analytics dashboard combining transaction data and macro indicators to score SME loan-default risk, giving micro-lenders an early-warning signal that cut projected non-performing loans by 19% in back-testing.',
    tech: ['Power BI', 'SQL', 'Python', 'scikit-learn', 'Excel'],
    badges: ['Bloomberg BMC', 'Case Competition Finalist'],
    approved: true,
  },
  {
    id: 'talent-3',
    studentName: 'Priya Nair',
    facultyId: 'pharmacy',
    programme: 'Bachelor of Pharmacy with Honours',
    gradYear: 2026,
    title: 'Nanoemulsion Delivery of Curcumin for Wound Healing',
    abstract:
      'Formulated and stability-tested a curcumin nanoemulsion, characterising droplet size and release kinetics. In-vitro assays showed a 2.3x improvement in dermal permeation over the free compound, supporting topical therapeutic use.',
    tech: ['HPLC', 'Zetasizer', 'GraphPad Prism', 'In-vitro Assay'],
    badges: ['BSL-2 Safety Cleared', 'Research Distinction'],
    approved: true,
  },
  {
    id: 'talent-4',
    studentName: 'Nurul Aziz',
    facultyId: 'education',
    programme: 'Bachelor of Arts (Honours) TESL',
    gradYear: 2026,
    title: 'Gamified Phonics Intervention for Struggling Year 3 Readers',
    abstract:
      'A quasi-experimental study of a tablet-based phonics game across two primary classrooms. The intervention group gained 1.4 reading levels over eight weeks versus 0.6 for the control, with markedly higher lesson engagement.',
    tech: ['Quasi-Experimental Design', 'SPSS', 'Classroom Observation'],
    badges: ['Practicum Excellence', 'Field Supervisor Commendation'],
    approved: true,
  },
  {
    id: 'talent-5',
    studentName: 'Daniel Wong',
    facultyId: 'lifesciences',
    programme: 'Bachelor of Science (Honours) in Biotechnology',
    gradYear: 2026,
    title: 'Bioplastic from Pineapple Waste via Microbial Fermentation',
    abstract:
      'Engineered a fermentation route converting Sarawak pineapple cannery waste into polyhydroxybutyrate bioplastic, reaching a 34% dry-cell yield and a fully compostable film — a circular-economy alternative to petroleum plastics.',
    tech: ['Fermentation', 'FTIR', 'GC-MS', 'Bioreactor'],
    badges: ['Green Innovation Award', 'Lab Safety Certified'],
    approved: true,
  },
  {
    id: 'talent-6',
    studentName: 'Marcus Lee',
    facultyId: 'computing_engineering',
    programme: 'Bachelor of Mechatronics Engineering with Honours',
    gradYear: 2026,
    title: 'Autonomous Warehouse Rover with SLAM Navigation',
    abstract:
      'Built a differential-drive rover that maps and navigates a warehouse using LiDAR-based SLAM, achieving sub-5cm trajectory drift and reliable dynamic obstacle avoidance for automated inventory picking.',
    tech: ['ROS2', 'C++', 'LiDAR', 'STM32', 'SLAM'],
    badges: ['Robotics Champion', 'CAD Verified'],
    approved: true,
  },
  {
    id: 'talent-7',
    studentName: 'Aisha Karim',
    facultyId: 'communication',
    programme: 'Bachelor of Mass Communication (Honours) Journalism',
    gradYear: 2026,
    title: 'Data-Journalism Investigation into Urban Air Quality',
    abstract:
      'A multi-part investigative feature pairing open government sensor data with community interviews to map pollution hotspots across the Klang Valley, published as an interactive story that reached over 40,000 readers.',
    tech: ['Data Journalism', 'Flourish', 'Adobe Premiere', 'OSINT'],
    badges: ['Published Portfolio', 'Editorial Excellence'],
    approved: true,
  },
  {
    id: 'talent-8',
    studentName: 'Sophia Tan',
    facultyId: 'hospitality',
    programme: 'Bachelor of Hospitality Management (Honours)',
    gradYear: 2026,
    title: 'Zero-Waste Banquet Operations Framework for Boutique Hotels',
    abstract:
      'Designed and piloted a zero-waste banquet workflow at a partner hotel, redesigning portioning, procurement and composting. The pilot reduced event food waste by 41% while holding guest-satisfaction scores steady.',
    tech: ['Operations Design', 'HACCP', 'Cost Analysis', 'Guest Survey'],
    badges: ['Sustainability Lead', 'Guest Experience Honours'],
    approved: true,
  },
];
