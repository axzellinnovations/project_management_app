package com.planora.backend.service;

import com.planora.backend.model.Sprintcolumn;
import com.planora.backend.model.Sprintboard;
import com.planora.backend.repository.SpringcolumnRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
public class SpringcolumnService {

    private final SpringcolumnRepository springcolumnRepository;

    public SpringcolumnService(SpringcolumnRepository springcolumnRepository) {
        this.springcolumnRepository = springcolumnRepository;
    }

    public void initializeColumnsForSprintboard(Sprintboard sprintboard) {
        List<String[]> columns = Arrays.asList(
                new String[]{"TO DO", "TODO"},
                new String[]{"IN PROGRESS", "IN_PROGRESS"},
                new String[]{"IN REVIEW", "IN_REVIEW"},
                new String[]{"DONE", "DONE"}
        );

        for (int i = 0; i < columns.size(); i++) {
            Sprintcolumn column = new Sprintcolumn();
            column.setColumnName(columns.get(i)[0]);
            column.setPosition(i);
            column.setColumnStatus(columns.get(i)[1]);
            column.setSprintboard(sprintboard);
            springcolumnRepository.save(column);
        }
    }

    @Transactional(readOnly = true)
    public List<Sprintcolumn> getColumnsBySprintboardId(Long sprintboardId) {
        return springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboardId);
    }
}