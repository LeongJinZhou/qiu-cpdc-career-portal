-- Slice 3b settings, permissions and a starter question bank (general questions, no personal data).

INSERT INTO setting (organisation_id, setting_key, value) VALUES
    (1, 'rate_mentor_request_per_user_per_hour', '5'),
    (1, 'mentor_open_requests_max', '3'),
    (1, 'rate_ai_per_user_per_min', '6'),
    (1, 'interview_ai_per_user_per_day', '20'),
    (1, 'interview_answer_max_chars', '2000'),
    (1, 'interview_questions_per_session', '5');

-- network.view (alumni directory), network.own (own directory entry and mentoring offer, alumni only),
-- mentoring.request (ask a mentor), mentoring.activity (CPDC overview), interview.practice (own practice sessions),
-- interview.bank (keep the question bank).
INSERT INTO role_permission (organisation_id, role, permission, scope) VALUES
    (1, 'superadmin', 'network.view', 'all'),
    (1, 'superadmin', 'mentoring.activity', 'all'),
    (1, 'superadmin', 'interview.bank', 'all'),
    (1, 'admin', 'network.view', 'all'),
    (1, 'admin', 'mentoring.activity', 'all'),
    (1, 'admin', 'interview.bank', 'all'),
    (1, 'staff', 'network.view', 'all'),
    (1, 'student', 'network.view', 'all'),
    (1, 'student', 'mentoring.request', 'own'),
    (1, 'student', 'interview.practice', 'own'),
    (1, 'alumni', 'network.view', 'all'),
    (1, 'alumni', 'network.own', 'own'),
    (1, 'alumni', 'interview.practice', 'own');

INSERT INTO interview_question (organisation_id, field, question, tip) VALUES
    (1, 'General', 'Tell me about yourself.', 'Two minutes: studies, one strong experience, why this role.'),
    (1, 'General', 'Why do you want to work for us?', 'Name something real about the company and link it to you.'),
    (1, 'General', 'Describe a time you worked in a team that disagreed.',
        'Use STAR: situation, task, action, result.'),
    (1, 'General', 'What is your biggest weakness?', 'A real one, and what you do about it.'),
    (1, 'General', 'Tell me about a mistake you made and what you learned.', 'Own it; spend most time on the fix.'),
    (1, 'General', 'Where do you see yourself in three years?', 'Show growth that fits the role.'),
    (1, 'Information Technology', 'Explain a project you built and the hardest bug you fixed.',
        'Say what you did, not only the team.'),
    (1, 'Information Technology', 'How would you explain an API to someone who does not code?',
        'A simple picture beats jargon.'),
    (1, 'Information Technology', 'How do you keep your technical skills up to date?', 'Give recent examples.'),
    (1, 'Business', 'Tell me about a time you persuaded someone to change their mind.',
        'Show how you listened before you argued.'),
    (1, 'Business', 'How would you decide between two good projects with one budget?',
        'Name the criteria, then decide.'),
    (1, 'Business', 'Describe a time you handled a difficult customer.', 'Use STAR and end with the result.'),
    (1, 'Health Sciences', 'Describe a time you had to stay calm under pressure.', 'Show the steps you took.'),
    (1, 'Health Sciences', 'How do you make sure you communicate clearly with patients or clients?',
        'Give a concrete example.'),
    (1, 'Health Sciences', 'Why did you choose this profession?', 'A personal reason, told briefly.');
