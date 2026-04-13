package com.planora.backend;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
@EnableScheduling
@EnableCaching
public class BackendApplication {

	private static void applyDotenvFromDirectory(Path directory) {
		if (directory == null) {
			return;
		}

		Dotenv dotenv = Dotenv.configure()
				.directory(directory.toString())
				.ignoreIfMissing()
				.load();

		dotenv.entries().forEach(entry -> {
			String key = entry.getKey();
			boolean hasSystemProperty = System.getProperty(key) != null && !System.getProperty(key).isBlank();
			boolean hasEnvironmentVariable = System.getenv(key) != null && !System.getenv(key).isBlank();

			if (!hasSystemProperty && !hasEnvironmentVariable) {
				System.setProperty(key, entry.getValue());
			}
		});
	}

	public static void main(String[] args) {
		Path workingDir = Paths.get("").toAbsolutePath();
		applyDotenvFromDirectory(workingDir);
		applyDotenvFromDirectory(workingDir.getParent());

		SpringApplication.run(BackendApplication.class, args);

	}

}
