package com.planora.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.Comment;
import com.planora.backend.model.Task;

public interface CommentRepository extends JpaRepository<Comment, Long> {
	List<Comment> findByTaskOrderByCreatedAtAsc(Task task);
}
