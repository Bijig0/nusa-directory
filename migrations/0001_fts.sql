-- Full-text search over listing title + description (FTS5, external content table).
CREATE VIRTUAL TABLE `listings_fts` USING fts5(
  `title`,
  `description`,
  content='listings',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `listings_fts_ai` AFTER INSERT ON `listings` BEGIN
  INSERT INTO `listings_fts`(rowid, title, description) VALUES (new.rowid, new.title, new.description);
END;
--> statement-breakpoint
CREATE TRIGGER `listings_fts_ad` AFTER DELETE ON `listings` BEGIN
  INSERT INTO `listings_fts`(`listings_fts`, rowid, title, description) VALUES ('delete', old.rowid, old.title, old.description);
END;
--> statement-breakpoint
CREATE TRIGGER `listings_fts_au` AFTER UPDATE OF `title`, `description` ON `listings` BEGIN
  INSERT INTO `listings_fts`(`listings_fts`, rowid, title, description) VALUES ('delete', old.rowid, old.title, old.description);
  INSERT INTO `listings_fts`(rowid, title, description) VALUES (new.rowid, new.title, new.description);
END;
