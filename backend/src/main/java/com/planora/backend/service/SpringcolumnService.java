package com.planora.backend.service;

import com.planora.backend.model.Sprintcolumn;
import com.planora.backend.model.SprintcolumnStatus;
import com.planora.backend.model.Sprintboard;
import com.planora.backend.repository.SpringcolumnRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class SpringcolumnService {

    private final SpringcolumnRepository springcolumnRepository;

    public SpringcolumnService(SpringcolumnRepository springcolumnRepository) {
        this.springcolumnRepository = springcolumnRepository;
    }

    public void initializeColumnsForSprintboard(Sprintboard sprintboard) {
        List<String> columnNames = Arrays.asList("TO DO", "IN PROGRESS", "IN REVIEW", "DONE");
        List<SprintcolumnStatus> statuses = Arrays.asList(
                SprintcolumnStatus.TODO,
                SprintcolumnStatus.IN_PROGRESS,
                SprintcolumnStatus.IN_REVIEW,
                SprintcolumnStatus.DONE
        );

        for (int i = 0; i < columnNames.size(); i++) {
            Sprintcolumn column = new Sprintcolumn();
            column.setColumnName(columnNames.get(i));
            column.setPosition(i);
            column.setColumnStatus(statuses.get(i));
            column.setSprintboard(sprintboard);

            springcolumnRepository.save(column);
        }
    }

    public List<Sprintcolumn> getColumnsBySprintboardId(Long sprintboardId) {
        return springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboardId);
    }
}