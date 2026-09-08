CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL
);
