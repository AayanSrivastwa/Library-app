DROP DATABASE IF EXISTS library_db;
CREATE DATABASE library_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_db;

-- Lookup tables
CREATE TABLE publishers (
    publisher_id   INT          NOT NULL,
    publisher_name VARCHAR(100) NOT NULL,
    city           VARCHAR(50)  NOT NULL,
    email          VARCHAR(100) NULL
) ENGINE=InnoDB;

CREATE TABLE authors (
    author_id   INT         NOT NULL,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    nationality VARCHAR(50) NULL
) ENGINE=InnoDB;

CREATE TABLE categories (
    category_id   INT         NOT NULL,
    category_name VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE membership_plans (
    plan_id      INT          NOT NULL,
    plan_name    VARCHAR(30)  NOT NULL,
    max_books    TINYINT      NOT NULL,
    loan_days    SMALLINT     NOT NULL,
    fine_per_day DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    annual_fee   DECIMAL(8,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB;

CREATE TABLE staff (
    staff_id  INT          NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role      VARCHAR(50)  NOT NULL,
    email     VARCHAR(100) NOT NULL,
    hire_date DATE         NOT NULL
) ENGINE=InnoDB;

-- Physical and digital resources
CREATE TABLE books (
    book_id          INT          NOT NULL,
    isbn             CHAR(13)     NOT NULL,
    title            VARCHAR(200) NOT NULL,
    publisher_id     INT          NOT NULL,
    category_id      INT          NOT NULL,
    publication_year SMALLINT     NOT NULL,
    language         VARCHAR(30)  NOT NULL DEFAULT 'English',
    price            DECIMAL(8,2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE book_authors (
    book_id   INT NOT NULL,
    author_id INT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE book_copies (
    copy_id        INT         NOT NULL,
    book_id        INT         NOT NULL,
    shelf_location VARCHAR(20) NOT NULL,
    copy_condition ENUM('Good','Damaged','Lost') NOT NULL DEFAULT 'Good',
    acquired_date  DATE        NOT NULL
) ENGINE=InnoDB;

CREATE TABLE digital_resources (
    resource_id    INT          NOT NULL,
    title          VARCHAR(200) NOT NULL,
    resource_type  ENUM('E-Book','Journal','Audio Book','Video') NOT NULL,
    publisher_id   INT          NOT NULL,
    category_id    INT          NOT NULL,
    file_format    VARCHAR(10)  NOT NULL,
    access_url     VARCHAR(255) NOT NULL,
    license_expiry DATE         NOT NULL
) ENGINE=InnoDB;

-- Members and transactions
CREATE TABLE members (
    member_id   INT         NOT NULL,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    email       VARCHAR(100) NOT NULL,
    phone       CHAR(10)    NOT NULL,
    join_date   DATE        NOT NULL,
    plan_id     INT         NOT NULL,
    referred_by INT         NULL,
    status      ENUM('Active','Suspended','Expired') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB;

CREATE TABLE loans (
    loan_id     INT  NOT NULL,
    copy_id     INT  NOT NULL,
    member_id   INT  NOT NULL,
    issued_by   INT  NOT NULL,
    issue_date  DATE NOT NULL,
    due_date    DATE NOT NULL,
    return_date DATE NULL
) ENGINE=InnoDB;

CREATE TABLE fines (
    fine_id        INT          NOT NULL,
    loan_id        INT          NOT NULL,
    fine_amount    DECIMAL(8,2) NOT NULL,
    fine_date      DATE         NOT NULL,
    payment_status ENUM('Unpaid','Paid','Waived') NOT NULL DEFAULT 'Unpaid',
    paid_date      DATE         NULL
) ENGINE=InnoDB;

CREATE TABLE reservations (
    reservation_id   INT  NOT NULL,
    book_id          INT  NOT NULL,
    member_id        INT  NOT NULL,
    reservation_date DATE NOT NULL,
    expiry_date      DATE NOT NULL,
    status           ENUM('Pending','Fulfilled','Cancelled','Expired') NOT NULL DEFAULT 'Pending'
) ENGINE=InnoDB;

CREATE TABLE digital_access_log (
    access_id        INT  NOT NULL,
    resource_id      INT  NOT NULL,
    member_id        INT  NOT NULL,
    access_date      DATE NOT NULL,
    duration_minutes INT  NOT NULL
) ENGINE=InnoDB;




-- ---------------------------------------------------------------------
-- SECTION 2: KEYS AND RELATIONS (PK, candidate keys, CHECK, FK)
-- ---------------------------------------------------------------------

-- 2.1 Primary keys (AUTO_INCREMENT is switched on once the key exists)
ALTER TABLE publishers        ADD PRIMARY KEY (publisher_id),   MODIFY publisher_id   INT NOT NULL AUTO_INCREMENT;
ALTER TABLE authors           ADD PRIMARY KEY (author_id),      MODIFY author_id      INT NOT NULL AUTO_INCREMENT;
ALTER TABLE categories        ADD PRIMARY KEY (category_id),    MODIFY category_id    INT NOT NULL AUTO_INCREMENT;
ALTER TABLE membership_plans  ADD PRIMARY KEY (plan_id),        MODIFY plan_id        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE staff             ADD PRIMARY KEY (staff_id),       MODIFY staff_id       INT NOT NULL AUTO_INCREMENT;
ALTER TABLE books             ADD PRIMARY KEY (book_id),        MODIFY book_id        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE book_authors      ADD PRIMARY KEY (book_id, author_id);
ALTER TABLE book_copies       ADD PRIMARY KEY (copy_id),        MODIFY copy_id        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE digital_resources ADD PRIMARY KEY (resource_id),    MODIFY resource_id    INT NOT NULL AUTO_INCREMENT;
ALTER TABLE members           ADD PRIMARY KEY (member_id),      MODIFY member_id      INT NOT NULL AUTO_INCREMENT;
ALTER TABLE loans             ADD PRIMARY KEY (loan_id),        MODIFY loan_id        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE fines             ADD PRIMARY KEY (fine_id),        MODIFY fine_id        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE reservations      ADD PRIMARY KEY (reservation_id), MODIFY reservation_id INT NOT NULL AUTO_INCREMENT;
ALTER TABLE digital_access_log ADD PRIMARY KEY (access_id),     MODIFY access_id      INT NOT NULL AUTO_INCREMENT;

-- 2.2 Candidate keys (UNIQUE)
ALTER TABLE publishers        ADD CONSTRAINT uq_publishers_name  UNIQUE (publisher_name);
ALTER TABLE categories        ADD CONSTRAINT uq_categories_name  UNIQUE (category_name);
ALTER TABLE membership_plans  ADD CONSTRAINT uq_plans_name       UNIQUE (plan_name);
ALTER TABLE staff             ADD CONSTRAINT uq_staff_email      UNIQUE (email);
ALTER TABLE books             ADD CONSTRAINT uq_books_isbn       UNIQUE (isbn);
ALTER TABLE digital_resources ADD CONSTRAINT uq_digital_url      UNIQUE (access_url);
ALTER TABLE members           ADD CONSTRAINT uq_members_email    UNIQUE (email);
ALTER TABLE members           ADD CONSTRAINT uq_members_phone    UNIQUE (phone);
ALTER TABLE fines             ADD CONSTRAINT uq_fines_loan       UNIQUE (loan_id);

-- 2.3 CHECK constraints (domain integrity)
ALTER TABLE membership_plans ADD CONSTRAINT chk_plans_limits CHECK (max_books > 0 AND loan_days > 0 AND fine_per_day >= 0 AND annual_fee >= 0);
ALTER TABLE books ADD CONSTRAINT chk_books_isbn  CHECK (isbn REGEXP '^[0-9]{13}$');
ALTER TABLE books ADD CONSTRAINT chk_books_price CHECK (price > 0);
ALTER TABLE books ADD CONSTRAINT chk_books_year  CHECK (publication_year BETWEEN 1800 AND 2100);
ALTER TABLE members ADD CONSTRAINT chk_members_email CHECK (email LIKE '%_@_%.__%');
ALTER TABLE loans ADD CONSTRAINT chk_loans_due    CHECK (due_date >= issue_date);
ALTER TABLE loans ADD CONSTRAINT chk_loans_return CHECK (return_date IS NULL OR return_date >= issue_date);
ALTER TABLE fines ADD CONSTRAINT chk_fines_amount  CHECK (fine_amount >= 0);
ALTER TABLE fines ADD CONSTRAINT chk_fines_payment CHECK ((payment_status = 'Paid' AND paid_date IS NOT NULL) OR (payment_status <> 'Paid' AND paid_date IS NULL));
ALTER TABLE reservations ADD CONSTRAINT chk_res_dates CHECK (expiry_date >= reservation_date);
ALTER TABLE digital_access_log ADD CONSTRAINT chk_access_duration CHECK (duration_minutes > 0);

-- 2.4 Foreign keys (referential integrity)
ALTER TABLE books
    ADD CONSTRAINT fk_books_publisher FOREIGN KEY (publisher_id) REFERENCES publishers (publisher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_books_category  FOREIGN KEY (category_id)  REFERENCES categories (category_id)  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE book_authors
    ADD CONSTRAINT fk_bookauthors_book   FOREIGN KEY (book_id)   REFERENCES books (book_id)     ON UPDATE CASCADE ON DELETE CASCADE,
    ADD CONSTRAINT fk_bookauthors_author FOREIGN KEY (author_id) REFERENCES authors (author_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE book_copies
    ADD CONSTRAINT fk_copies_book FOREIGN KEY (book_id) REFERENCES books (book_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE digital_resources
    ADD CONSTRAINT fk_digital_publisher FOREIGN KEY (publisher_id) REFERENCES publishers (publisher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_digital_category  FOREIGN KEY (category_id)  REFERENCES categories (category_id)  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE members
    ADD CONSTRAINT fk_members_plan     FOREIGN KEY (plan_id)     REFERENCES membership_plans (plan_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_members_referrer FOREIGN KEY (referred_by) REFERENCES members (member_id)        ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE loans
    ADD CONSTRAINT fk_loans_copy   FOREIGN KEY (copy_id)   REFERENCES book_copies (copy_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_loans_member FOREIGN KEY (member_id) REFERENCES members (member_id)   ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_loans_staff  FOREIGN KEY (issued_by) REFERENCES staff (staff_id)      ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE fines
    ADD CONSTRAINT fk_fines_loan FOREIGN KEY (loan_id) REFERENCES loans (loan_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE reservations
    ADD CONSTRAINT fk_res_book   FOREIGN KEY (book_id)   REFERENCES books (book_id)     ON UPDATE CASCADE ON DELETE CASCADE,
    ADD CONSTRAINT fk_res_member FOREIGN KEY (member_id) REFERENCES members (member_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE digital_access_log
    ADD CONSTRAINT fk_access_resource FOREIGN KEY (resource_id) REFERENCES digital_resources (resource_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_access_member   FOREIGN KEY (member_id)   REFERENCES members (member_id)             ON UPDATE CASCADE ON DELETE CASCADE;




-- ---------------------------------------------------------------------
-- SECTION 3: DATA INSERTION (parents first, children after)
-- ---------------------------------------------------------------------

INSERT INTO publishers (publisher_id, publisher_name, city, email) VALUES
(1, 'Penguin Random House India', 'Gurugram',   'contact@penguin.example.com'),
(2, 'Oxford University Press',    'Oxford',     'info@oup.example.com'),
(3, 'McGraw Hill Education',      'New York',   'info@mcgrawhill.example.com'),
(4, 'Pearson India',              'Noida',      'care@pearson.example.com'),
(5, 'Rupa Publications',          'New Delhi',  'sales@rupa.example.com'),
(6, 'HarperCollins India',        'Noida',      'india@harpercollins.example.com'),
(7, 'MIT Press',                  'Cambridge',  'books@mitpress.example.com');

INSERT INTO categories (category_id, category_name) VALUES
(1, 'Computer Science'),
(2, 'Fiction'),
(3, 'Science'),
(4, 'History'),
(5, 'Business'),
(6, 'Biography');

INSERT INTO authors (author_id, first_name, last_name, nationality) VALUES
(1,  'Thomas H.',   'Cormen',      'American'),
(2,  'Charles E.',  'Leiserson',   'American'),
(3,  'Abraham',     'Silberschatz','American'),
(4,  'Henry F.',    'Korth',       'American'),
(5,  'S.',          'Sudarshan',   'Indian'),
(6,  'Ramez',       'Elmasri',     'American'),
(7,  'Shamkant B.', 'Navathe',     'Indian'),
(8,  'R. K.',       'Narayan',     'Indian'),
(9,  'Chetan',      'Bhagat',      'Indian'),
(10, 'Yuval Noah',  'Harari',      'Israeli'),
(11, 'Stephen',     'Hawking',     'British'),
(12, 'A. P. J.',    'Abdul Kalam', 'Indian'),
(13, 'Ruskin',      'Bond',        'Indian'),
(14, 'Robert T.',   'Kiyosaki',    'American'),
(15, 'Andrew S.',   'Tanenbaum',   'Dutch');

INSERT INTO membership_plans (plan_id, plan_name, max_books, loan_days, fine_per_day, annual_fee) VALUES
(1, 'Student', 3,  14, 2.00, 200.00),
(2, 'Faculty', 10, 30, 1.00, 500.00),
(3, 'Public',  2,  10, 5.00, 400.00),
(4, 'Premium', 5,  21, 1.00, 1000.00);

INSERT INTO staff (staff_id, full_name, role, email, hire_date) VALUES
(1, 'Meera Kapoor',  'Head Librarian',             'meera.kapoor@library.example.edu',  '2018-04-02'),
(2, 'Rohit Sinha',   'Library Assistant',          'rohit.sinha@library.example.edu',   '2020-07-13'),
(3, 'Anjali Verma',  'Library Assistant',          'anjali.verma@library.example.edu',  '2021-01-18'),
(4, 'Deepak Rao',    'Digital Resource Manager',   'deepak.rao@library.example.edu',    '2022-09-05');

INSERT INTO books (book_id, isbn, title, publisher_id, category_id, publication_year, language, price) VALUES
(1,  '9781234500011', 'Introduction to Algorithms',                 7, 1, 2022, 'English', 1250.00),
(2,  '9781234500028', 'Database System Concepts',                   3, 1, 2019, 'English',  899.00),
(3,  '9781234500035', 'Fundamentals of Database Systems',           4, 1, 2016, 'English',  799.00),
(4,  '9781234500042', 'Modern Operating Systems',                   4, 1, 2014, 'English',  750.00),
(5,  '9781234500059', 'Computer Networks',                          4, 1, 2010, 'English',  720.00),
(6,  '9781234500066', 'Malgudi Days',                               1, 2, 2006, 'English',  299.00),
(7,  '9781234500073', 'Five Point Someone',                         5, 2, 2004, 'English',  175.00),
(8,  '9781234500080', 'The Room on the Roof',                       1, 2, 2014, 'English',  250.00),
(9,  '9781234500097', 'Sapiens: A Brief History of Humankind',      6, 4, 2015, 'English',  499.00),
(10, '9781234500103', 'A Brief History of Time',                    1, 3, 2011, 'English',  399.00),
(11, '9781234500110', 'Wings of Fire',                              5, 6, 1999, 'English',  350.00),
(12, '9781234500127', 'Rich Dad Poor Dad',                          6, 5, 2017, 'English',  420.00),
(13, '9781234500134', 'Homo Deus: A Brief History of Tomorrow',     6, 4, 2017, 'English',  550.00),
(14, '9781234500141', 'The Blue Umbrella',                          5, 2, 2008, 'English',  200.00),
(15, '9781234500158', 'Brief Answers to the Big Questions',         1, 3, 2018, 'English',  450.00);

INSERT INTO book_authors (book_id, author_id) VALUES
(1, 1), (1, 2), (2, 3), (2, 4), (2, 5), (3, 6), (3, 7), (4, 15), (5, 15), (6, 8),
(7, 9), (8, 13), (9, 10), (10, 11), (11, 12), (12, 14), (13, 10), (14, 13), (15, 11);

INSERT INTO book_copies (copy_id, book_id, shelf_location, copy_condition, acquired_date) VALUES
(1,  1,  'CS-A1', 'Good',    '2023-06-15'),
(2,  1,  'CS-A1', 'Good',    '2023-06-15'),
(3,  1,  'CS-A1', 'Good',    '2024-01-10'),
(4,  2,  'CS-A2', 'Good',    '2023-06-15'),
(5,  2,  'CS-A2', 'Good',    '2023-06-15'),
(6,  2,  'CS-A2', 'Good',    '2024-08-20'),
(7,  3,  'CS-A3', 'Good',    '2022-07-01'),
(8,  3,  'CS-A3', 'Good',    '2022-07-01'),
(9,  4,  'CS-B1', 'Good',    '2021-08-12'),
(10, 4,  'CS-B1', 'Good',    '2021-08-12'),
(11, 5,  'CS-B2', 'Good',    '2021-08-12'),
(12, 6,  'FI-C1', 'Good',    '2020-03-05'),
(13, 6,  'FI-C1', 'Damaged', '2020-03-05'),
(14, 7,  'FI-C2', 'Good',    '2022-11-18'),
(15, 7,  'FI-C2', 'Good',    '2022-11-18'),
(16, 7,  'FI-C2', 'Good',    '2023-02-02'),
(17, 8,  'FI-C3', 'Good',    '2023-05-09'),
(18, 8,  'FI-C3', 'Good',    '2023-05-09'),
(19, 9,  'HI-D1', 'Good',    '2022-01-20'),
(20, 9,  'HI-D1', 'Good',    '2022-01-20'),
(21, 9,  'HI-D1', 'Good',    '2024-03-14'),
(22, 10, 'SC-E1', 'Good',    '2021-09-30'),
(23, 10, 'SC-E1', 'Good',    '2021-09-30'),
(24, 11, 'BI-F1', 'Good',    '2022-04-04'),
(25, 11, 'BI-F1', 'Good',    '2022-04-04'),
(26, 12, 'BU-G1', 'Good',    '2023-10-25'),
(27, 12, 'BU-G1', 'Good',    '2023-10-25'),
(28, 13, 'HI-D2', 'Good',    '2024-02-17'),
(29, 14, 'FI-C4', 'Good',    '2024-06-06'),
(30, 15, 'SC-E2', 'Good',    '2025-01-15'),
(31, 15, 'SC-E2', 'Lost',    '2025-01-15');

INSERT INTO digital_resources (resource_id, title, resource_type, publisher_id, category_id, file_format, access_url, license_expiry) VALUES
(1, 'Learning SQL (Digital Edition)',       'E-Book',     4, 1, 'PDF',  'https://library.example.edu/digital/learning-sql',        '2027-06-30'),
(2, 'Data Structures Video Lectures',       'Video',      3, 1, 'MP4',  'https://library.example.edu/digital/ds-lectures',         '2027-03-31'),
(3, 'Indian History Audiobook',             'Audio Book', 1, 4, 'MP3',  'https://library.example.edu/digital/indian-history',      '2027-01-31'),
(4, 'Journal of Computer Science Research', 'Journal',    2, 1, 'PDF',  'https://library.example.edu/digital/jcsr',                '2026-12-31'),
(5, 'Introduction to Astronomy',            'E-Book',     2, 3, 'EPUB', 'https://library.example.edu/digital/astronomy',           '2027-09-30'),
(6, 'Business Strategy Case Studies',       'E-Book',     6, 5, 'PDF',  'https://library.example.edu/digital/business-cases',      '2027-05-31'),
(7, 'Classic Short Stories Audiobook',      'Audio Book', 1, 2, 'MP3',  'https://library.example.edu/digital/short-stories',       '2027-08-31'),
(8, 'Cybersecurity Fundamentals',           'E-Book',     4, 1, 'PDF',  'https://library.example.edu/digital/cybersecurity',       '2027-11-30');

INSERT INTO members (member_id, first_name, last_name, email, phone, join_date, plan_id, referred_by, status) VALUES
(1,  'Aarav',  'Sharma',   'aarav.sharma@example.com',   '9876500001', '2025-07-15', 1, NULL, 'Active'),
(2,  'Diya',   'Patel',    'diya.patel@example.com',     '9876500002', '2025-08-01', 1, 1,    'Active'),
(3,  'Rohan',  'Mehta',    'rohan.mehta@example.com',    '9876500003', '2025-08-10', 1, 1,    'Active'),
(4,  'Priya',  'Nair',     'priya.nair@example.com',     '9876500004', '2024-01-20', 2, NULL, 'Active'),
(5,  'Vikram', 'Singh',    'vikram.singh@example.com',   '9876500005', '2025-09-05', 3, NULL, 'Active'),
(6,  'Sneha',  'Reddy',    'sneha.reddy@example.com',    '9876500006', '2025-09-12', 1, 2,    'Active'),
(7,  'Arjun',  'Verma',    'arjun.verma@example.com',    '9876500007', '2024-11-03', 4, 4,    'Active'),
(8,  'Kavya',  'Iyer',     'kavya.iyer@example.com',     '9876500008', '2026-01-10', 1, 3,    'Active'),
(9,  'Manish', 'Gupta',    'manish.gupta@example.com',   '9876500009', '2026-02-14', 3, 5,    'Suspended'),
(10, 'Neha',   'Joshi',    'neha.joshi@example.com',     '9876500010', '2023-06-01', 2, NULL, 'Active'),
(11, 'Rahul',  'Das',      'rahul.das@example.com',      '9876500011', '2026-03-22', 1, 6,    'Active'),
(12, 'Ishita', 'Banerjee', 'ishita.banerjee@example.com','9876500012', '2025-12-05', 4, 7,    'Active');

INSERT INTO loans (loan_id, copy_id, member_id, issued_by, issue_date, due_date, return_date) VALUES
(1,  1,  1,  2, '2026-08-03', '2026-08-17', '2026-08-15'),
(2,  4,  1,  2, '2026-08-20', '2026-09-03', '2026-09-10'),
(3,  7,  2,  3, '2026-08-25', '2026-09-08', '2026-09-08'),
(4,  9,  4,  2, '2026-08-28', '2026-09-27', '2026-09-20'),
(5,  12, 5,  3, '2026-09-01', '2026-09-11', '2026-09-18'),
(6,  14, 3,  2, '2026-09-03', '2026-09-17', '2026-09-16'),
(7,  19, 6,  3, '2026-09-05', '2026-09-19', '2026-09-25'),
(8,  2,  7,  1, '2026-09-08', '2026-09-29', '2026-09-28'),
(9,  22, 8,  3, '2026-09-10', '2026-09-24', '2026-09-24'),
(10, 5,  3,  2, '2026-09-14', '2026-09-28', '2026-10-02'),
(11, 26, 9,  3, '2026-09-15', '2026-09-25', '2026-10-05'),
(12, 20, 10, 2, '2026-09-18', '2026-10-18', '2026-10-12'),
(13, 24, 11, 3, '2026-09-20', '2026-10-04', '2026-10-03'),
(14, 17, 12, 2, '2026-09-22', '2026-10-13', '2026-10-10'),
(15, 8,  2,  3, '2026-09-25', '2026-10-09', '2026-10-09'),
(16, 3,  6,  2, '2026-09-28', '2026-10-12', '2026-10-20'),
(17, 15, 1,  3, '2026-10-01', '2026-10-15', '2026-10-14'),
(18, 28, 7,  1, '2026-10-03', '2026-10-24', '2026-10-22'),
(19, 29, 5,  3, '2026-10-05', '2026-10-15', '2026-10-13'),
(20, 10, 4,  2, '2026-10-08', '2026-11-07', '2026-10-30'),
(21, 12, 8,  3, '2026-10-10', '2026-10-24', '2026-10-23'),
(22, 6,  12, 2, '2026-10-12', '2026-11-02', '2026-11-01'),
(23, 21, 3,  3, '2026-10-14', '2026-10-28', '2026-11-04'),
(24, 14, 11, 2, '2026-10-18', '2026-11-01', '2026-10-31'),
(25, 1,  10, 3, '2026-10-20', '2026-11-19', '2026-11-10'),
(26, 7,  1,  2, '2026-10-22', '2026-11-05', NULL),
(27, 11, 9,  3, '2026-10-25', '2026-11-04', NULL),
(28, 19, 2,  2, '2026-10-30', '2026-11-13', NULL),
(29, 30, 6,  3, '2026-11-03', '2026-11-17', NULL),
(30, 9,  7,  2, '2026-11-08', '2026-11-29', NULL),
(31, 22, 11, 3, '2026-11-10', '2026-11-24', NULL),
(32, 4,  4,  2, '2026-11-12', '2026-12-12', NULL),
(33, 14, 8,  3, '2026-11-14', '2026-11-28', NULL);

INSERT INTO fines (fine_id, loan_id, fine_amount, fine_date, payment_status, paid_date) VALUES
(1, 2,  14.00, '2026-09-10', 'Paid',   '2026-09-10'),
(2, 5,  35.00, '2026-09-18', 'Paid',   '2026-09-20'),
(3, 7,  12.00, '2026-09-25', 'Paid',   '2026-09-26'),
(4, 10,  8.00, '2026-10-02', 'Paid',   '2026-10-03'),
(5, 11, 50.00, '2026-10-05', 'Unpaid', NULL),
(6, 16, 16.00, '2026-10-20', 'Unpaid', NULL),
(7, 23, 14.00, '2026-11-04', 'Waived', NULL);

INSERT INTO reservations (reservation_id, book_id, member_id, reservation_date, expiry_date, status) VALUES
(1, 1,  3,  '2026-10-15', '2026-10-22', 'Fulfilled'),
(2, 3,  5,  '2026-11-05', '2026-11-19', 'Pending'),
(3, 9,  7,  '2026-11-06', '2026-11-20', 'Pending'),
(4, 5,  2,  '2026-10-28', '2026-11-04', 'Expired'),
(5, 12, 8,  '2026-10-30', '2026-11-06', 'Cancelled'),
(6, 7,  12, '2026-11-10', '2026-11-24', 'Pending'),
(7, 10, 4,  '2026-11-11', '2026-11-25', 'Pending'),
(8, 4,  11, '2026-11-12', '2026-11-26', 'Pending');

INSERT INTO digital_access_log (access_id, resource_id, member_id, access_date, duration_minutes) VALUES
(1,  1, 1,  '2026-09-02', 45),
(2,  2, 1,  '2026-09-15', 60),
(3,  1, 2,  '2026-09-18', 30),
(4,  4, 4,  '2026-09-20', 25),
(5,  8, 3,  '2026-09-22', 50),
(6,  5, 6,  '2026-09-27', 40),
(7,  3, 7,  '2026-10-01', 90),
(8,  1, 8,  '2026-10-04', 35),
(9,  2, 10, '2026-10-06', 55),
(10, 6, 12, '2026-10-09', 70),
(11, 8, 1,  '2026-10-12', 65),
(12, 7, 7,  '2026-10-15', 80),
(13, 1, 11, '2026-10-18', 20),
(14, 4, 10, '2026-10-22', 30),
(15, 2, 3,  '2026-10-25', 45),
(16, 8, 6,  '2026-10-28', 55),
(17, 1, 1,  '2026-11-02', 40),
(18, 3, 12, '2026-11-05', 85),
(19, 5, 2,  '2026-11-08', 35),
(20, 1, 4,  '2026-11-12', 30);




-- ---------------------------------------------------------------------
-- SECTION 4: INDEXES (foreign keys already got their own indexes in MySQL)
-- ---------------------------------------------------------------------

CREATE INDEX idx_books_title          ON books (title);
CREATE INDEX idx_members_name         ON members (last_name, first_name);
CREATE INDEX idx_loans_return_due     ON loans (return_date, due_date);
CREATE INDEX idx_loans_issue_date     ON loans (issue_date);
CREATE INDEX idx_fines_status         ON fines (payment_status);
CREATE INDEX idx_reservations_status  ON reservations (status);
CREATE INDEX idx_access_resource_date ON digital_access_log (resource_id, access_date);

-- Verify the indexes exist
SHOW INDEX FROM loans;

-- Proof that indexes are used (check the "key" column in the output).
-- On a tiny table the optimizer can still pick a full scan, which is normal.
EXPLAIN SELECT book_id, title FROM books WHERE title = 'Sapiens: A Brief History of Humankind';
EXPLAIN SELECT loan_id, due_date FROM loans WHERE return_date IS NULL AND due_date < CURDATE();




-- ---------------------------------------------------------------------
-- SECTION 5: VIEWS
-- ---------------------------------------------------------------------

-- View 1: books that are not yet returned and are past the due date
CREATE OR REPLACE VIEW v_overdue_books AS
SELECT l.loan_id,
       CONCAT(m.first_name, ' ', m.last_name)            AS member_name,
       m.phone,
       b.title                                            AS book_title,
       l.copy_id,
       l.issue_date,
       l.due_date,
       DATEDIFF(CURDATE(), l.due_date)                    AS days_overdue,
       DATEDIFF(CURDATE(), l.due_date) * p.fine_per_day   AS estimated_fine
FROM loans l
JOIN members m          ON m.member_id = l.member_id
JOIN membership_plans p ON p.plan_id   = m.plan_id
JOIN book_copies c      ON c.copy_id   = l.copy_id
JOIN books b            ON b.book_id   = c.book_id
WHERE l.return_date IS NULL
  AND l.due_date < CURDATE();

-- View 2: how many times each book has been borrowed
CREATE OR REPLACE VIEW v_book_popularity AS
SELECT b.book_id,
       b.title,
       cat.category_name,
       COUNT(l.loan_id) AS total_loans
FROM books b
JOIN categories cat   ON cat.category_id = b.category_id
LEFT JOIN book_copies c ON c.book_id = b.book_id
LEFT JOIN loans l       ON l.copy_id = c.copy_id
GROUP BY b.book_id, b.title, cat.category_name;

-- View 3: one-row summary of every member's library usage
CREATE OR REPLACE VIEW v_member_activity AS
SELECT m.member_id,
       CONCAT(m.first_name, ' ', m.last_name) AS member_name,
       p.plan_name,
       m.status,
       (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.member_id)              AS physical_loans,
       (SELECT COUNT(*) FROM digital_access_log d WHERE d.member_id = m.member_id) AS digital_accesses,
       (SELECT COALESCE(SUM(f.fine_amount), 0)
          FROM fines f JOIN loans l ON l.loan_id = f.loan_id
         WHERE l.member_id = m.member_id AND f.payment_status = 'Unpaid')          AS unpaid_fines
FROM members m
JOIN membership_plans p ON p.plan_id = m.plan_id;

-- View 4: copies that are in good condition and not currently on loan
CREATE OR REPLACE VIEW v_available_copies AS
SELECT c.copy_id, b.title, c.shelf_location
FROM book_copies c
JOIN books b ON b.book_id = c.book_id
WHERE c.copy_condition = 'Good'
  AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL);

-- Using the views
SELECT * FROM v_overdue_books ORDER BY days_overdue DESC;
SELECT * FROM v_book_popularity ORDER BY total_loans DESC, title;
SELECT * FROM v_member_activity ORDER BY member_id;
SELECT * FROM v_available_copies ORDER BY title, copy_id;




-- ---------------------------------------------------------------------
-- SECTION 6: DML (INSERT, UPDATE, DELETE after the initial load)
-- ---------------------------------------------------------------------

-- New member without an id: AUTO_INCREMENT gives member_id 13
INSERT INTO members (first_name, last_name, email, phone, join_date, plan_id, referred_by)
VALUES ('Tanvi', 'Kulkarni', 'tanvi.kulkarni@example.com', '9876500013', '2026-11-16', 1, 11);

-- A member changed their phone number
UPDATE members SET phone = '9876500111' WHERE member_id = 11;

-- The damaged copy was repaired
UPDATE book_copies SET copy_condition = 'Good' WHERE copy_id = 13;

-- A fine was paid (status and date move together because of chk_fines_payment)
UPDATE fines SET payment_status = 'Paid', paid_date = '2026-11-16' WHERE fine_id = 6;

-- Housekeeping: remove reservations that are no longer useful
DELETE FROM reservations WHERE status IN ('Cancelled', 'Expired');

-- Check the result of the DML above
SELECT member_id, first_name, phone FROM members WHERE member_id IN (11, 13);
SELECT reservation_id, book_id, status FROM reservations ORDER BY reservation_id;




-- ---------------------------------------------------------------------
-- SECTION 7: JOINS AND REPORT QUERIES
-- ---------------------------------------------------------------------

-- 7.1 INNER JOIN: complete loan history (5 tables)
SELECT l.loan_id,
       CONCAT(m.first_name, ' ', m.last_name) AS member_name,
       b.title,
       c.copy_id,
       s.full_name AS issued_by,
       l.issue_date, l.due_date, l.return_date
FROM loans l
INNER JOIN members m     ON m.member_id = l.member_id
INNER JOIN book_copies c ON c.copy_id   = l.copy_id
INNER JOIN books b       ON b.book_id   = c.book_id
INNER JOIN staff s       ON s.staff_id  = l.issued_by
ORDER BY l.issue_date, l.loan_id;

-- 7.2 INNER JOIN with M:N table: books with all their authors in one row
SELECT b.title,
       GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) ORDER BY a.last_name SEPARATOR ', ') AS authors
FROM books b
INNER JOIN book_authors ba ON ba.book_id = b.book_id
INNER JOIN authors a       ON a.author_id = ba.author_id
GROUP BY b.book_id, b.title
ORDER BY b.title;

-- 7.3 Overdue books (not returned, due date already passed), via the view
SELECT * FROM v_overdue_books ORDER BY days_overdue DESC;

-- 7.4 Frequently borrowed books (top 5 by number of loans)
SELECT b.title, COUNT(l.loan_id) AS times_borrowed
FROM books b
INNER JOIN book_copies c ON c.book_id = b.book_id
INNER JOIN loans l       ON l.copy_id = c.copy_id
GROUP BY b.book_id, b.title
ORDER BY times_borrowed DESC, b.title
LIMIT 5;

-- 7.5 Borrowing pattern by category
SELECT cat.category_name, COUNT(l.loan_id) AS total_loans
FROM categories cat
INNER JOIN books b       ON b.category_id = cat.category_id
INNER JOIN book_copies c ON c.book_id = b.book_id
INNER JOIN loans l       ON l.copy_id = c.copy_id
GROUP BY cat.category_id, cat.category_name
ORDER BY total_loans DESC;

-- 7.6 LEFT JOIN: members who have never borrowed a physical book
SELECT m.member_id, CONCAT(m.first_name, ' ', m.last_name) AS member_name
FROM members m
LEFT JOIN loans l ON l.member_id = m.member_id
WHERE l.loan_id IS NULL;

-- 7.7 RIGHT JOIN: every copy with its loan count, then only never-borrowed copies
SELECT c.copy_id, b.title, COUNT(l.loan_id) AS times_issued
FROM loans l
RIGHT JOIN book_copies c ON c.copy_id = l.copy_id
INNER JOIN books b       ON b.book_id = c.book_id
GROUP BY c.copy_id, b.title
HAVING COUNT(l.loan_id) = 0
ORDER BY c.copy_id;

-- 7.8 FULL OUTER JOIN (MySQL has no FULL JOIN keyword, so LEFT UNION RIGHT)
SELECT b.title, r.reservation_id, r.status
FROM books b
LEFT JOIN reservations r ON r.book_id = b.book_id
UNION
SELECT b.title, r.reservation_id, r.status
FROM books b
RIGHT JOIN reservations r ON r.book_id = b.book_id;

-- 7.9 SELF JOIN: who referred whom (members table joined to itself)
SELECT CONCAT(m.first_name, ' ', m.last_name)     AS member_name,
       CONCAT(ref.first_name, ' ', ref.last_name) AS referred_by
FROM members m
LEFT JOIN members ref ON ref.member_id = m.referred_by
ORDER BY m.member_id;

-- 7.10 SELF JOIN: pairs of members on the same plan
SELECT p.plan_name,
       CONCAT(m1.first_name, ' ', m1.last_name) AS member_one,
       CONCAT(m2.first_name, ' ', m2.last_name) AS member_two
FROM members m1
INNER JOIN members m2          ON m1.plan_id = m2.plan_id AND m1.member_id < m2.member_id
INNER JOIN membership_plans p  ON p.plan_id = m1.plan_id
WHERE p.plan_name IN ('Faculty', 'Premium')
ORDER BY p.plan_name, m1.member_id, m2.member_id;

-- 7.11 Fine collection summary by payment status
SELECT payment_status, COUNT(*) AS fine_count, SUM(fine_amount) AS total_amount
FROM fines
GROUP BY payment_status
ORDER BY total_amount DESC;




-- ---------------------------------------------------------------------
-- SECTION 8: SUBQUERIES (nested and correlated)
-- ---------------------------------------------------------------------

-- 8.1 Nested (IN): members who borrowed at least one Computer Science book
SELECT member_id, CONCAT(first_name, ' ', last_name) AS member_name
FROM members
WHERE member_id IN (SELECT l.member_id
                      FROM loans l
                      JOIN book_copies c ON c.copy_id = l.copy_id
                      JOIN books b       ON b.book_id = c.book_id
                      JOIN categories cat ON cat.category_id = b.category_id
                     WHERE cat.category_name = 'Computer Science')
ORDER BY member_id;

-- 8.2 Nested (scalar): books priced above the overall average price
SELECT title, price
FROM books
WHERE price > (SELECT AVG(price) FROM books)
ORDER BY price DESC;

-- 8.3 Correlated: books priced above the average of their own category
SELECT b1.title, b1.price, b1.category_id
FROM books b1
WHERE b1.price > (SELECT AVG(b2.price) FROM books b2 WHERE b2.category_id = b1.category_id)
ORDER BY b1.category_id, b1.price DESC;

-- 8.4 Correlated (EXISTS): members who currently owe an unpaid fine
SELECT m.member_id, CONCAT(m.first_name, ' ', m.last_name) AS member_name
FROM members m
WHERE EXISTS (SELECT 1
                FROM fines f
                JOIN loans l ON l.loan_id = f.loan_id
               WHERE l.member_id = m.member_id
                 AND f.payment_status = 'Unpaid');

-- 8.5 Correlated (NOT EXISTS): books nobody has reserved
SELECT b.book_id, b.title
FROM books b
WHERE NOT EXISTS (SELECT 1 FROM reservations r WHERE r.book_id = b.book_id)
ORDER BY b.book_id;

-- 8.6 Subquery in HAVING: books borrowed more often than the average book
SELECT b.title, COUNT(l.loan_id) AS times_borrowed
FROM books b
JOIN book_copies c ON c.book_id = b.book_id
JOIN loans l       ON l.copy_id = c.copy_id
GROUP BY b.book_id, b.title
HAVING COUNT(l.loan_id) > (SELECT COUNT(*) / (SELECT COUNT(*) FROM books) FROM loans)
ORDER BY times_borrowed DESC, b.title;

-- 8.7 Subquery in FROM (derived table): average loan period of returned books per plan
SELECT p.plan_name, ROUND(t.avg_days_kept, 1) AS avg_days_kept
FROM (SELECT m.plan_id, AVG(DATEDIFF(l.return_date, l.issue_date)) AS avg_days_kept
        FROM loans l
        JOIN members m ON m.member_id = l.member_id
       WHERE l.return_date IS NOT NULL
       GROUP BY m.plan_id) t
JOIN membership_plans p ON p.plan_id = t.plan_id
ORDER BY p.plan_id;




-- ---------------------------------------------------------------------
-- SECTION 9: SET OPERATIONS (UNION, INTERSECT, EXCEPT)
-- Oracle users: EXCEPT is written as MINUS.
-- ---------------------------------------------------------------------

-- 9.1 UNION: members who used the library in any way (physical or digital)
SELECT member_id FROM loans
UNION
SELECT member_id FROM digital_access_log
ORDER BY member_id;

-- 9.2 INTERSECT: members who borrowed physical books AND used digital resources
SELECT member_id FROM loans
INTERSECT
SELECT member_id FROM digital_access_log
ORDER BY member_id;

-- 9.3 EXCEPT: members who borrowed physical books but never used digital resources
SELECT member_id FROM loans
EXCEPT
SELECT member_id FROM digital_access_log
ORDER BY member_id;

-- 9.4 EXCEPT: books that have copies on the shelf but were never reserved
SELECT book_id FROM book_copies
EXCEPT
SELECT book_id FROM reservations
ORDER BY book_id;




-- ---------------------------------------------------------------------
-- SECTION 10: WINDOW FUNCTIONS
-- ---------------------------------------------------------------------

-- 10.1 RANK and DENSE_RANK: most borrowed books inside each category
SELECT category_name,
       title,
       total_loans,
       RANK()       OVER (PARTITION BY category_name ORDER BY total_loans DESC) AS category_position,
       DENSE_RANK() OVER (ORDER BY total_loans DESC)                            AS overall_position
FROM v_book_popularity
ORDER BY category_name, category_position, title;

-- 10.2 ROW_NUMBER: most recent loan of every member
SELECT member_id, loan_id, issue_date
FROM (SELECT l.member_id, l.loan_id, l.issue_date,
             ROW_NUMBER() OVER (PARTITION BY l.member_id ORDER BY l.issue_date DESC, l.loan_id DESC) AS rn
        FROM loans l) latest
WHERE rn = 1
ORDER BY member_id;

-- 10.3 LAG: loans per month and the change from the previous month
SELECT month_label,
       loans_issued,
       LAG(loans_issued) OVER (ORDER BY month_label)                 AS previous_month,
       loans_issued - LAG(loans_issued) OVER (ORDER BY month_label)  AS change_from_previous
FROM (SELECT DATE_FORMAT(issue_date, '%Y-%m') AS month_label, COUNT(*) AS loans_issued
        FROM loans
       GROUP BY DATE_FORMAT(issue_date, '%Y-%m')) monthly
ORDER BY month_label;

-- 10.4 Running total of fines raised over time
SELECT fine_id, fine_date, fine_amount,
       SUM(fine_amount) OVER (ORDER BY fine_date, fine_id) AS running_total
FROM fines
ORDER BY fine_date, fine_id;

-- 10.5 NTILE: split members into 3 groups by number of physical loans
SELECT member_id, member_name, physical_loans,
       NTILE(3) OVER (ORDER BY physical_loans DESC, member_id) AS activity_group
FROM v_member_activity
ORDER BY activity_group, member_id;




-- ---------------------------------------------------------------------
-- SECTION 11: CTEs (simple, multiple and recursive)
-- ---------------------------------------------------------------------

-- 11.1 Simple CTE: classify members by how much they borrow
WITH member_loans AS (
    SELECT member_id, COUNT(*) AS loan_count
    FROM loans
    GROUP BY member_id
)
SELECT m.member_id,
       CONCAT(m.first_name, ' ', m.last_name) AS member_name,
       ml.loan_count,
       CASE WHEN ml.loan_count >= 4 THEN 'Heavy reader'
            WHEN ml.loan_count = 3 THEN 'Regular reader'
            ELSE 'Occasional reader' END AS reader_type
FROM member_loans ml
JOIN members m ON m.member_id = ml.member_id
ORDER BY ml.loan_count DESC, m.member_id;

-- 11.2 Multiple CTEs: monthly library usage, physical vs digital
WITH physical AS (
    SELECT DATE_FORMAT(issue_date, '%Y-%m') AS month_label, COUNT(*) AS physical_loans
    FROM loans
    GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
),
digital AS (
    SELECT DATE_FORMAT(access_date, '%Y-%m') AS month_label, COUNT(*) AS digital_accesses
    FROM digital_access_log
    GROUP BY DATE_FORMAT(access_date, '%Y-%m')
)
SELECT p.month_label,
       p.physical_loans,
       COALESCE(d.digital_accesses, 0) AS digital_accesses
FROM physical p
LEFT JOIN digital d ON d.month_label = p.month_label
ORDER BY p.month_label;

-- 11.3 Recursive CTE: referral chain starting from member 1
WITH RECURSIVE referral_tree AS (
    SELECT member_id,
           CONCAT(first_name, ' ', last_name) AS member_name,
           0 AS depth
    FROM members
    WHERE member_id = 1
    UNION ALL
    SELECT m.member_id,
           CONCAT(m.first_name, ' ', m.last_name),
           rt.depth + 1
    FROM members m
    JOIN referral_tree rt ON m.referred_by = rt.member_id
)
SELECT depth, member_id, member_name
FROM referral_tree
ORDER BY depth, member_id;




-- ---------------------------------------------------------------------
-- SECTION 12: DCL (users, roles, GRANT and REVOKE)
-- Needs an account with CREATE USER and GRANT OPTION (e.g. root).
-- Change the sample passwords before using this anywhere real.
-- ---------------------------------------------------------------------

DROP USER IF EXISTS 'lib_admin'@'localhost', 'lib_staff'@'localhost', 'lib_member'@'localhost';
DROP ROLE IF EXISTS 'library_admin', 'library_staff', 'library_member';

CREATE ROLE 'library_admin', 'library_staff', 'library_member';

-- Administrator: everything inside library_db
GRANT ALL PRIVILEGES ON library_db.* TO 'library_admin';

-- Librarian: read everything, add records, update only the circulation tables
GRANT SELECT, INSERT ON library_db.* TO 'library_staff';
GRANT UPDATE ON library_db.loans        TO 'library_staff';
GRANT UPDATE ON library_db.fines        TO 'library_staff';
GRANT UPDATE ON library_db.reservations TO 'library_staff';
GRANT UPDATE ON library_db.book_copies  TO 'library_staff';

-- Member (read-only catalogue access)
GRANT SELECT ON library_db.books             TO 'library_member';
GRANT SELECT ON library_db.authors           TO 'library_member';
GRANT SELECT ON library_db.book_authors      TO 'library_member';
GRANT SELECT ON library_db.categories        TO 'library_member';
GRANT SELECT ON library_db.digital_resources TO 'library_member';
GRANT SELECT ON library_db.v_available_copies TO 'library_member';

CREATE USER 'lib_admin'@'localhost'  IDENTIFIED BY 'Admin@12345';
CREATE USER 'lib_staff'@'localhost'  IDENTIFIED BY 'Staff@12345';
CREATE USER 'lib_member'@'localhost' IDENTIFIED BY 'Member@12345';

GRANT 'library_admin'  TO 'lib_admin'@'localhost';
GRANT 'library_staff'  TO 'lib_staff'@'localhost';
GRANT 'library_member' TO 'lib_member'@'localhost';

SET DEFAULT ROLE ALL TO 'lib_admin'@'localhost', 'lib_staff'@'localhost', 'lib_member'@'localhost';

-- REVOKE demo: staff may no longer change copy records
REVOKE UPDATE ON library_db.book_copies FROM 'library_staff';

-- Verify
SHOW GRANTS FOR 'lib_staff'@'localhost' USING 'library_staff';
SHOW GRANTS FOR 'lib_member'@'localhost' USING 'library_member';




-- ---------------------------------------------------------------------
-- SECTION 13: TCL (COMMIT, ROLLBACK, SAVEPOINT)
-- ---------------------------------------------------------------------

-- 13.1 COMMIT: issue a reserved book. Both steps succeed together or not at all.
START TRANSACTION;
INSERT INTO loans (copy_id, member_id, issued_by, issue_date, due_date)
VALUES (23, 4, 2, '2026-11-17', '2026-12-17');
UPDATE reservations SET status = 'Fulfilled' WHERE reservation_id = 7;
COMMIT;

SELECT loan_id, copy_id, member_id, issue_date, due_date FROM loans ORDER BY loan_id DESC LIMIT 1;
SELECT reservation_id, status FROM reservations WHERE reservation_id = 7;

-- 13.2 ROLLBACK: a change that is undone before it is saved
START TRANSACTION;
UPDATE members SET status = 'Suspended' WHERE member_id = 2;
SELECT member_id, status FROM members WHERE member_id = 2;
ROLLBACK;
SELECT member_id, status FROM members WHERE member_id = 2;

-- 13.3 SAVEPOINT: undo only the second half of a transaction
START TRANSACTION;
INSERT INTO reservations (book_id, member_id, reservation_date, expiry_date)
VALUES (13, 10, '2026-11-17', '2026-11-24');
SAVEPOINT after_first_reservation;
INSERT INTO reservations (book_id, member_id, reservation_date, expiry_date)
VALUES (8, 10, '2026-11-17', '2026-11-24');
ROLLBACK TO SAVEPOINT after_first_reservation;
COMMIT;

SELECT reservation_id, book_id, member_id, status FROM reservations WHERE member_id = 10;
