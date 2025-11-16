-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert default post themes
INSERT INTO post_themes (day_of_week, theme_name, content_category, description, example_topics) VALUES
(1, 'Tech Tips or Thread', 'tech_tips', 'Share valuable technical tips and tutorials', '{"VS Code shortcuts", "Git tips", "debugging techniques", "keyboard shortcuts", "productivity hacks"}'),
(2, 'Personal / Career Journey', 'career_journey', 'Share personal experiences and career growth stories', '{"How I learned React", "career transitions", "lessons learned", "interview experiences", "skill development"}'),
(3, 'Faith & Productivity', 'faith_productivity', 'Combine faith insights with productivity principles', '{"Faith-inspired productivity", "balance", "purpose in work", "spiritual growth", "work-life harmony"}'),
(4, 'Project / Portfolio / Learning Update', 'project_update', 'Showcase recent projects and learning progress', '{"Built a new feature", "Learning Next.js", "portfolio showcase", "new skills", "side projects"}'),
(5, 'Problem/Solution or Dev Insight', 'dev_insight', 'Share technical problems and their solutions', '{"Solved this bug today", "architecture decisions", "code reviews", "technical challenges", "best practices"}'),
(6, 'Motivational / Inspirational', 'motivational', 'Inspire and motivate fellow developers', '{"Developer motivation", "overcoming imposter syndrome", "growth mindset", "career advice", "personal growth"}'),
(0, 'Faith, Gratitude, or Reflection', 'reflection', 'Reflect on the week and express gratitude', '{"Weekly reflection", "gratitude", "faith and purpose", "lessons learned", "future goals"}');

-- Insert default job search queries
INSERT INTO job_search_queries (user_id, query_text, platform, active) VALUES
('default-user', 'frontend developer remote', 'twitter', true),
('default-user', 'react developer hiring', 'twitter', true),
('default-user', 'nodejs developer remote', 'twitter', true);