import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path } from 'react-native-svg';
import { T, STATUS_MAP, StatusKey } from '../../constants/tokens';
import {
  BoardMember,
  BoardLabel,
  BoardTask,
  KanbanBoardColumn,
  useProjectBoard,
} from '../../hooks/useProjectBoard';

const PRIORITY_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  URGENT: { dot: '#EF4444', text: '#B91C1C', bg: '#FEF2F2' },
  HIGH: { dot: '#F97316', text: '#C2410C', bg: '#FFF7ED' },
  MEDIUM: { dot: '#F59E0B', text: '#B45309', bg: '#FFFBEB' },
  NORMAL: { dot: '#3B82F6', text: '#1D4ED8', bg: '#EFF6FF' },
  LOW: { dot: '#94A3B8', text: '#64748B', bg: '#F8FAFC' },
};

function statusAccent(status: string, color?: string | null) {
  if (color?.startsWith('#')) return color;
  return STATUS_MAP[status as StatusKey]?.dot ?? T.primary;
}

function formatColumnName(column: KanbanBoardColumn) {
  return column.name || column.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(dateString?: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(dateString?: string | null) {
  if (!dateString) return null;
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(task: BoardTask) {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return !Number.isNaN(due.getTime()) && due < today;
}

function initialsFromName(name?: string | null) {
  if (!name) return '--';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function labelStyle(label: BoardLabel) {
  const color = label.color?.startsWith('#') ? label.color : T.primary;
  return {
    backgroundColor: `${color}16`,
    borderColor: `${color}30`,
    color,
  };
}

function BoardBackdrop() {
  return (
    <View pointerEvents="none" style={s.backdrop}>
      <LinearGradient
        colors={['rgba(21, 93, 252, 0.16)', 'rgba(34, 197, 94, 0.08)', 'rgba(247, 248, 250, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.backdropTop}
      />
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.10)', 'rgba(21, 93, 252, 0.04)', 'rgba(247, 248, 250, 0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.backdropBottom}
      />
    </View>
  );
}

function SearchIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

function PlusIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={active ? T.primary : '#64748B'} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={7} r={4} />
      <Path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </Svg>
  );
}

function TagIcon({ active }: { active: boolean }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={active ? T.primary : '#64748B'} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 13 11 22l-9-9V4h9l9 9z" />
      <Circle cx={7.5} cy={8.5} r={1.5} />
    </Svg>
  );
}

function CalendarIcon({ color = '#64748B' }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Path d="M3 10h18" />
      <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

function TaskCard({
  task,
  onDelete,
  onDueDatePress,
  onDragEnd,
  onDragStateChange,
  onDragMove,
}: {
  task: BoardTask;
  onDelete: (task: BoardTask) => void;
  onDueDatePress: (task: BoardTask) => void;
  onDragEnd: (task: BoardTask, dropX: number, translationX: number) => void;
  onDragStateChange: (active: boolean) => void;
  onDragMove: (screenX: number) => void;
}) {
  const priority = task.priority ? PRIORITY_STYLES[task.priority.toUpperCase()] ?? PRIORITY_STYLES.LOW : null;
  const due = formatDate(task.dueDate);
  const overdue = isOverdue(task);
  const labels = (task.labels || []).slice(0, 2);
  const completedSubtasks = task.subtasks?.filter((subtask) => subtask.status === 'DONE').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActiveRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const resetDragState = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    dragActiveRef.current = false;
    setIsDragging(false);
    onDragStateChange(false);
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        longPressTimer.current = setTimeout(() => {
          dragActiveRef.current = true;
          setIsDragging(true);
          onDragStateChange(true);
        }, 220);
      },
      onPanResponderMove: (_, gesture) => {
        if (!dragActiveRef.current) {
          if (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10) {
            resetDragState();
          }
          return;
        }
        drag.setValue({ x: gesture.dx, y: gesture.dy });
        onDragMove(gesture.moveX);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldDrop = dragActiveRef.current;
        resetDragState();
        if (shouldDrop) {
          onDragEnd(task, gesture.moveX, gesture.dx);
        }
        onDragMove(-1);
        Animated.spring(drag, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          tension: 170,
          friction: 18,
        }).start();
      },
      onPanResponderTerminate: () => {
        resetDragState();
        onDragMove(-1);
        Animated.spring(drag, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          tension: 170,
          friction: 18,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        card.card,
        isDragging && card.cardDragging,
        { transform: [...drag.getTranslateTransform(), { scale: isDragging ? 1.03 : 1 }] },
      ]}
    >
      <TouchableOpacity hitSlop={10} onPress={() => onDelete(task)} style={card.iconBtn}>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 6h18" />
          <Path d="M8 6V4h8v2" />
          <Path d="M19 6l-1 14H6L5 6" />
        </Svg>
      </TouchableOpacity>

      <View style={card.dragSurface}>
        <View {...panResponder.panHandlers} style={card.topRow}>
          {priority && task.priority ? (
            <View style={[card.priority, { backgroundColor: priority.bg, borderColor: `${priority.dot}24` }]}>
              <View style={[card.priorityDot, { backgroundColor: priority.dot }]} />
              <Text style={[card.priorityText, { color: priority.text }]}>{task.priority}</Text>
            </View>
          ) : <View />}
        </View>

        <Text style={card.title} numberOfLines={3}>{task.title}</Text>

        {!!task.description && (
          <Text style={card.description} numberOfLines={2}>{task.description}</Text>
        )}

        <View style={card.metaRow}>
          {task.projectTaskNumber != null && (
            <View style={card.codePill}>
              <Text style={card.codeText}>TSK-{task.projectTaskNumber}</Text>
            </View>
          )}
          {task.storyPoint != null && task.storyPoint > 0 && (
            <View style={card.codePill}>
              <Text style={card.codeText}>{task.storyPoint} pts</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => onDueDatePress(task)}
            style={[card.duePill, overdue && card.duePillOverdue, !due && card.duePillEmpty]}
          >
            <CalendarIcon color={overdue ? '#DC2626' : due ? '#64748B' : T.primary} />
            <Text style={[card.dueDate, overdue && card.overdue, !due && card.dueDateEmpty]}>
              {overdue ? 'Overdue' : due || 'Set date'}
            </Text>
          </TouchableOpacity>
        </View>

        {labels.length > 0 && (
          <View style={card.labelRow}>
            {labels.map((label) => {
              const colors = labelStyle(label);
              return (
                <View key={label.id} style={[card.labelPill, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
                  <Text style={[card.labelText, { color: colors.color }]} numberOfLines={1}>{label.name}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={card.footerRow}>
          <View style={card.assigneeRow}>
            <View style={card.avatar}>
              <Text style={card.avatarText}>{initialsFromName(task.assigneeName)}</Text>
            </View>
            <Text style={card.assigneeName} numberOfLines={1}>{task.assigneeName || 'Unassigned'}</Text>
          </View>

          {totalSubtasks > 0 && (
            <View style={card.subtaskWrap}>
              <Text style={card.subtaskCount}>{completedSubtasks}/{totalSubtasks}</Text>
              <View style={card.progressTrack}>
                <View style={[card.progressFill, { width: `${Math.max(4, (completedSubtasks / totalSubtasks) * 100)}%` }]} />
              </View>
            </View>
          )}
        </View>

      </View>
    </Animated.View>
  );
}

function BoardColumn({
  column,
  tasks,
  onDeleteTask,
  onDueDatePress,
  onCreateTask,
  onDeleteColumn,
  onDragTask,
  onDragStateChange,
  onDragMove,
}: {
  column: KanbanBoardColumn;
  tasks: BoardTask[];
  onDeleteTask: (task: BoardTask) => void;
  onDueDatePress: (task: BoardTask) => void;
  onCreateTask: (column: KanbanBoardColumn) => void;
  onDeleteColumn: (column: KanbanBoardColumn) => void;
  onDragTask: (task: BoardTask, column: KanbanBoardColumn, dropX: number, translationX: number) => void;
  onDragStateChange: (active: boolean) => void;
  onDragMove: (screenX: number) => void;
}) {
  const accent = statusAccent(column.status, column.color);
  const wipExceeded = !!column.wipLimit && column.wipLimit > 0 && tasks.length > column.wipLimit;
  const canDeleteColumn = tasks.length === 0;

  return (
    <View style={columnStyles.card}>
      <View style={[columnStyles.accent, { backgroundColor: accent }]} />
      <View style={columnStyles.header}>
        <View style={columnStyles.headerLeft}>
          <View style={[columnStyles.statusDot, { backgroundColor: accent }]} />
          <Text style={columnStyles.title} numberOfLines={1}>{formatColumnName(column)}</Text>
        </View>
        <View style={columnStyles.headerActions}>
          {canDeleteColumn ? (
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => onDeleteColumn(column)}
              style={columnStyles.headerDeleteBtn}
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 6h18" />
                <Path d="M8 6V4h8v2" />
                <Path d="M19 6l-1 14H6L5 6" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <View style={wipExceeded ? columnStyles.wipPill : columnStyles.countPill}>
              <Text style={[columnStyles.countText, wipExceeded && columnStyles.wipText]}>
                {wipExceeded ? `${tasks.length}/${column.wipLimit}` : tasks.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={columnStyles.body}>
        {tasks.length === 0 ? (
          <TouchableOpacity activeOpacity={0.75} onPress={() => onCreateTask(column)} style={columnStyles.emptyState}>
            <Text style={columnStyles.emptyTitle}>No tasks yet</Text>
            <Text style={columnStyles.emptyText}>Tap to add one here.</Text>
          </TouchableOpacity>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onDelete={onDeleteTask}
              onDueDatePress={onDueDatePress}
              onDragStateChange={onDragStateChange}
              onDragMove={onDragMove}
              onDragEnd={(draggedTask, dropX, translationX) => onDragTask(draggedTask, column, dropX, translationX)}
            />
          ))
        )}
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={() => onCreateTask(column)} style={columnStyles.addTaskBtn}>
        <PlusIcon color={T.primary} />
        <Text style={columnStyles.addTaskText}>Add task</Text>
      </TouchableOpacity>
    </View>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildCalendarCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function DatePickerModal({
  visible,
  task,
  titleText = 'Due date',
  subtitleText,
  selectedDate,
  monthDate,
  saving,
  onChangeMonth,
  onClose,
  onSelect,
  onClear,
}: {
  visible: boolean;
  task: BoardTask | null;
  titleText?: string;
  subtitleText?: string;
  selectedDate?: string | null;
  monthDate: Date;
  saving: boolean;
  onChangeMonth: (date: Date) => void;
  onClose: () => void;
  onSelect: (date: string) => void;
  onClear: () => void;
}) {
  const activeDate = selectedDate ?? task?.dueDate?.slice(0, 10) ?? null;
  const today = formatDateInput(new Date());
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const cells = buildCalendarCells(monthDate);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={dateModal.safe}>
        <View style={dateModal.sheet}>
          <View style={dateModal.handle} />
          <View style={dateModal.header}>
            <View style={dateModal.headerIcon}>
              <CalendarIcon color="#FFFFFF" />
            </View>
            <View style={dateModal.headerText}>
              <Text style={dateModal.title}>{titleText}</Text>
              <Text style={dateModal.subtitle} numberOfLines={1}>{subtitleText || task?.title || 'Task'}</Text>
            </View>
          </View>

          <View style={dateModal.monthRow}>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => onChangeMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              style={dateModal.monthBtn}
            >
              <Text style={dateModal.monthBtnText}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={dateModal.monthTitle}>{monthLabel}</Text>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => onChangeMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              style={dateModal.monthBtn}
            >
              <Text style={dateModal.monthBtnText}>{'>'}</Text>
            </TouchableOpacity>
          </View>

          <View style={dateModal.weekRow}>
            {WEEKDAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={dateModal.weekText}>{day}</Text>
            ))}
          </View>

          <View style={dateModal.dayGrid}>
            {cells.map((date, index) => {
              const value = date ? formatDateInput(date) : '';
              const isSelected = value && value === activeDate;
              const isToday = value && value === today;
              return (
                <TouchableOpacity
                  key={`${value}-${index}`}
                  activeOpacity={date ? 0.76 : 1}
                  disabled={!date || saving}
                  onPress={() => date && onSelect(value)}
                  style={[
                    dateModal.dayCell,
                    isToday && dateModal.dayToday,
                    isSelected && dateModal.daySelected,
                    !date && dateModal.dayEmpty,
                  ]}
                >
                  <Text style={[
                    dateModal.dayText,
                    isToday && dateModal.dayTodayText,
                    isSelected && dateModal.daySelectedText,
                  ]}>
                    {date ? date.getDate() : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={dateModal.actions}>
            <TouchableOpacity activeOpacity={0.78} disabled={saving} onPress={onClear} style={dateModal.clearBtn}>
              <Text style={dateModal.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.78} disabled={saving} onPress={onClose} style={dateModal.doneBtn}>
              <Text style={dateModal.doneText}>{saving ? 'Saving...' : 'Done'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function AssigneePickerModal({
  visible,
  members,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  members: BoardMember[];
  selectedId: number | null;
  onClose: () => void;
  onSelect: (id: number | null) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={modal.safe}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>Assignee</Text>
          <Text style={modal.subtitle}>Choose who owns this task</Text>

          <TouchableOpacity
            activeOpacity={0.78}
            style={[modal.option, selectedId === null && modal.optionActive]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          >
            <View style={[modal.optionDot, { backgroundColor: selectedId === null ? T.primary : '#CBD5E1' }]} />
            <Text style={modal.optionText}>Unassigned</Text>
            {selectedId === null && <Text style={modal.currentText}>Selected</Text>}
          </TouchableOpacity>

          {members.map((member) => {
            const active = selectedId === member.userId;
            return (
              <TouchableOpacity
                key={member.userId}
                activeOpacity={0.78}
                style={[modal.option, active && modal.optionActive]}
                onPress={() => {
                  onSelect(member.userId);
                  onClose();
                }}
              >
                <View style={[modal.assigneeAvatar, active && modal.assigneeAvatarActive]}>
                  <Text style={[modal.assigneeAvatarText, active && modal.assigneeAvatarTextActive]}>{initialsFromName(member.name)}</Text>
                </View>
                <Text style={modal.optionText} numberOfLines={1}>{member.name}</Text>
                {active && <Text style={modal.currentText}>Selected</Text>}
              </TouchableOpacity>
            );
          })}

          {members.length === 0 && (
            <View style={modal.emptyOption}>
              <Text style={modal.emptyOptionText}>No members found</Text>
            </View>
          )}

          <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={modal.secondaryBtn}>
            <Text style={modal.secondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function ProjectBoardScreen({
  projectId,
  projectName,
  topOffset = 0,
}: {
  projectId: number;
  projectName?: string;
  topOffset?: number;
}) {
  const { width } = useWindowDimensions();
  const {
    board,
    columns,
    tasks,
    members,
    loading,
    refreshing,
    error,
    refresh,
    moveTask,
    createTask,
    deleteTask,
    updateTaskDueDate,
    createColumn,
    deleteColumn,
  } = useProjectBoard(projectId);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [filterSheet, setFilterSheet] = useState<'assignee' | 'priority' | null>(null);
  const [taskTarget, setTaskTarget] = useState<KanbanBoardColumn | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(null);
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<number | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [dateTask, setDateTask] = useState<BoardTask | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [savingDate, setSavingDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCardDragging, setIsCardDragging] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const boardRef = useRef<ScrollView | null>(null);
  const boardScrollX = useRef(0);
  const boardViewportX = useRef(0);
  const columnFrames = useRef<Record<string, { x: number; width: number }>>({});
  const lastDragScreenX = useRef(-1);
  const columnWidth = Math.min(width * 0.84, 326);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    if (!isCardDragging) {
      lastDragScreenX.current = -1;
      return;
    }

    const edgeSize = 82;
    const maxScrollX = Math.max(0, ((columns.length + 1) * (columnWidth + 14)) + 24 - width);
    const interval = setInterval(() => {
      const screenX = lastDragScreenX.current;
      if (screenX < 0) return;

      const leftEdge = boardViewportX.current + edgeSize;
      const rightEdge = width - edgeSize;
      let delta = 0;

      if (screenX > rightEdge) {
        delta = 12 + Math.min(28, (screenX - rightEdge) * 0.32);
      } else if (screenX < leftEdge) {
        delta = -(12 + Math.min(28, (leftEdge - screenX) * 0.32));
      }

      if (!delta) return;

      const nextX = Math.max(0, Math.min(maxScrollX, boardScrollX.current + delta));
      if (nextX === boardScrollX.current) return;

      boardScrollX.current = nextX;
      boardRef.current?.scrollTo({ x: nextX, animated: false });
    }, 16);

    return () => clearInterval(interval);
  }, [columnWidth, columns.length, isCardDragging, width]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.assigneeName?.trim()) names.add(task.assigneeName.trim());
    });
    return ['ALL', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [tasks]);

  const priorityOptions = useMemo(() => ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'], []);

  const visibleTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      if (selectedAssignee !== 'ALL' && (task.assigneeName || '').trim() !== selectedAssignee) return false;
      if (selectedPriority !== 'ALL' && (task.priority || '').toUpperCase() !== selectedPriority) return false;
      if (!term) return true;

      const labels = task.labels?.some((label) => label.name.toLowerCase().includes(term));
      return labels || [
        task.title,
        task.description || '',
        task.assigneeName || '',
        task.priority || '',
        task.status || '',
        `tsk-${task.projectTaskNumber ?? task.id}`,
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [searchTerm, selectedAssignee, selectedPriority, tasks]);

  const columnTasks = useMemo(() => {
    const grouped: Record<string, BoardTask[]> = {};
    columns.forEach((column) => { grouped[column.status] = []; });
    visibleTasks.forEach((task) => {
      if (!grouped[task.status]) grouped[task.status] = [];
      grouped[task.status].push(task);
    });
    return grouped;
  }, [columns, visibleTasks]);

  const metrics = useMemo(() => {
    const total = visibleTasks.length;
    const done = visibleTasks.filter((task) => task.status === 'DONE').length;
    const doing = visibleTasks.filter((task) => task.status === 'IN_PROGRESS').length;
    const progress = total ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, progress };
  }, [visibleTasks]);

  const openCreateTask = (column: KanbanBoardColumn) => {
    setTaskTarget(column);
    setNewTaskTitle('');
    setNewTaskDueDate(null);
    setNewTaskAssigneeId(null);
    setShowTaskModal(true);
  };

  const openDatePicker = (task: BoardTask) => {
    const parsed = parseDateInput(task.dueDate);
    setDateTask(task);
    setCalendarMonth(parsed || new Date());
  };

  const changeTaskDueDate = async (dueDate: string | null) => {
    if (!dateTask) return;
    setSavingDate(true);
    try {
      await updateTaskDueDate(dateTask.id, dueDate);
      setDateTask(null);
    } catch {
      Alert.alert('Date not updated', 'The due date could not be changed.');
    } finally {
      setSavingDate(false);
    }
  };

  const submitCreateTask = async () => {
    if (!taskTarget || !newTaskTitle.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        title: newTaskTitle,
        status: taskTarget.status,
        dueDate: newTaskDueDate,
        assigneeId: newTaskAssigneeId,
      });
      setShowTaskModal(false);
      setTaskTarget(null);
      setNewTaskTitle('');
      setNewTaskDueDate(null);
      setNewTaskAssigneeId(null);
    } catch {
      Alert.alert('Task not created', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedNewTaskAssignee = members.find((member) => member.userId === newTaskAssigneeId);

  const submitCreateColumn = async () => {
    if (!newColumnName.trim()) return;
    setSubmitting(true);
    try {
      await createColumn(newColumnName);
      setShowColumnModal(false);
      setNewColumnName('');
    } catch {
      Alert.alert('Column not created', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragTask = async (
    task: BoardTask,
    sourceColumn: KanbanBoardColumn,
    dropX: number,
    translationX: number
  ) => {
    const threshold = 32;
    if (Math.abs(translationX) < threshold) return;

    const sourceFrame = columnFrames.current[sourceColumn.status];
    const fingerDropX = boardScrollX.current + dropX - boardViewportX.current;
    const cardCenterDropX = sourceFrame
      ? sourceFrame.x + (sourceFrame.width / 2) + translationX
      : fingerDropX;

    const findColumnAt = (x: number) => columns.find((column) => {
      const frame = columnFrames.current[column.status];
      return frame && x >= frame.x && x <= frame.x + frame.width;
    });

    let targetColumn = findColumnAt(cardCenterDropX) ?? findColumnAt(fingerDropX);

    if (!targetColumn || targetColumn.status === task.status) {
      const currentIndex = columns.findIndex((column) => column.status === sourceColumn.status);
      const direction = translationX > 0 ? 1 : -1;
      const draggedFarEnough = Math.abs(translationX) > columnWidth * 0.28;
      if (draggedFarEnough) {
        targetColumn = columns[currentIndex + direction];
      }
    }

    if (!targetColumn || targetColumn.status === task.status) return;

    try {
      await moveTask(task, targetColumn.status);
    } catch {
      Alert.alert('Move failed', 'The task could not be moved.');
    }
  };

  const handleDragMove = (screenX: number) => {
    lastDragScreenX.current = screenX;
  };

  const confirmDeleteTask = (task: BoardTask) => {
    Alert.alert('Delete task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
          } catch {
            Alert.alert('Delete failed', 'The task could not be deleted.');
          }
        },
      },
    ]);
  };

  const confirmDeleteColumn = (column: KanbanBoardColumn) => {
    const tasksInColumn = columnTasks[column.status]?.length ?? 0;
    if (tasksInColumn > 0) return;
    if (column.id <= 0) {
      Alert.alert('Column not ready', 'Refresh the board and try again.');
      return;
    }

    Alert.alert('Delete column', `Delete "${formatColumnName(column)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteColumn(column.id);
          } catch {
            Alert.alert('Delete failed', 'The column could not be deleted.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={topOffset ? ['left', 'right'] : ['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <BoardBackdrop />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: topOffset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} colors={[T.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.hero, { opacity: fade }]}>
          <View pointerEvents="none" style={s.glassLayer}>
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            <View style={s.glassWash} />
          </View>
          <View style={s.heroTop}>
            <LinearGradient
              colors={[T.primary, '#4D8BFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.boardMark}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 4h5v16H4z" />
                <Path d="M10.5 4h4.5v11h-4.5z" />
                <Path d="M16.5 4H20v14h-3.5z" />
              </Svg>
            </LinearGradient>
            <View style={s.heroTitleWrap}>
              <Text style={s.eyebrow}>KANBAN BOARD</Text>
              <Text style={s.title} numberOfLines={1}>{projectName || board?.name || 'Board'}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.84} onPress={() => setShowColumnModal(true)} style={s.heroActionBtn}>
              <PlusIcon color={T.primary} />
            </TouchableOpacity>
          </View>

          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${metrics.progress}%` }]} />
            </View>
            <Text style={s.progressText}>{metrics.progress}% complete</Text>
          </View>

          <View style={s.metricsRow}>
            <Metric label="Tasks" value={metrics.total} accent={T.primary} />
            <Metric label="Doing" value={metrics.doing} accent={T.statusInProg.dot} />
            <Metric label="Done" value={metrics.done} accent={T.statusDone.dot} />
          </View>

          <View style={s.filterRow}>
            <View style={s.searchWrap}>
              <SearchIcon />
              <TextInput
                style={s.searchInput}
                placeholder="Search tasks..."
                placeholderTextColor="#94A3B8"
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setFilterSheet('assignee')}
              style={[s.filterBtn, selectedAssignee !== 'ALL' && s.filterBtnActive]}
            >
              <UserIcon active={selectedAssignee !== 'ALL'} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setFilterSheet('priority')}
              style={[s.filterBtn, selectedPriority !== 'ALL' && s.filterBtnActive]}
            >
              <TagIcon active={selectedPriority !== 'ALL'} />
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </Animated.View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.primary} />
            <Text style={s.loadingText}>Loading board...</Text>
          </View>
        ) : (
          <ScrollView
            ref={boardRef}
            horizontal
            removeClippedSubviews={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.boardRow}
            decelerationRate="fast"
            snapToInterval={columnWidth + 14}
            snapToAlignment="start"
            scrollEnabled={!isCardDragging}
            scrollEventThrottle={16}
            onLayout={(event) => {
              boardViewportX.current = event.nativeEvent.layout.x;
            }}
            onScroll={(event) => {
              boardScrollX.current = event.nativeEvent.contentOffset.x;
            }}
          >
            {columns.map((column) => (
              <View
                key={column.status}
                style={{ width: columnWidth, overflow: 'visible' }}
                onLayout={(event) => {
                  columnFrames.current[column.status] = {
                    x: event.nativeEvent.layout.x,
                    width: event.nativeEvent.layout.width,
                  };
                }}
              >
                <BoardColumn
                  column={column}
                  tasks={columnTasks[column.status] || []}
                  onDeleteTask={confirmDeleteTask}
                  onDueDatePress={openDatePicker}
                  onCreateTask={openCreateTask}
                  onDeleteColumn={confirmDeleteColumn}
                  onDragTask={handleDragTask}
                  onDragStateChange={setIsCardDragging}
                  onDragMove={handleDragMove}
                />
              </View>
            ))}
            <View style={{ width: columnWidth }}>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setShowColumnModal(true)}
                style={s.addColumnCard}
              >
                <View style={s.addColumnIcon}>
                  <PlusIcon color={T.primary} />
                </View>
                <Text style={s.addColumnText}>Add column</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        <View style={s.bottomPad} />
      </ScrollView>

      <Modal visible={filterSheet !== null} transparent animationType="slide">
        <SafeAreaView style={modal.safe}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>{filterSheet === 'assignee' ? 'Assignee' : 'Priority'}</Text>
            <Text style={modal.subtitle}>Choose a filter</Text>
            {(filterSheet === 'assignee' ? assigneeOptions : priorityOptions).map((option) => {
              const active = filterSheet === 'assignee'
                ? selectedAssignee === option
                : selectedPriority === option;
              const label = option === 'ALL'
                ? 'All'
                : option.charAt(0) + option.slice(1).toLowerCase().replace(/_/g, ' ');

              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.78}
                  style={[modal.option, active && modal.optionActive]}
                  onPress={() => {
                    if (filterSheet === 'assignee') {
                      setSelectedAssignee(option);
                    } else {
                      setSelectedPriority(option);
                    }
                    setFilterSheet(null);
                  }}
                >
                  <View style={[modal.optionDot, { backgroundColor: active ? T.primary : '#CBD5E1' }]} />
                  <Text style={modal.optionText}>{label}</Text>
                  {active && <Text style={modal.currentText}>Selected</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setFilterSheet(null)} style={modal.secondaryBtn}>
              <Text style={modal.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <DatePickerModal
        visible={!!dateTask}
        task={dateTask}
        monthDate={calendarMonth}
        saving={savingDate}
        onChangeMonth={setCalendarMonth}
        onClose={() => setDateTask(null)}
        onSelect={changeTaskDueDate}
        onClear={() => changeTaskDueDate(null)}
      />

      <DatePickerModal
        visible={showCreateDatePicker}
        task={null}
        titleText="Task due date"
        subtitleText={newTaskTitle.trim() || 'New task'}
        selectedDate={newTaskDueDate}
        monthDate={calendarMonth}
        saving={false}
        onChangeMonth={setCalendarMonth}
        onClose={() => setShowCreateDatePicker(false)}
        onSelect={(date) => {
          setNewTaskDueDate(date);
          setShowCreateDatePicker(false);
        }}
        onClear={() => {
          setNewTaskDueDate(null);
          setShowCreateDatePicker(false);
        }}
      />

      <AssigneePickerModal
        visible={showAssigneePicker}
        members={members}
        selectedId={newTaskAssigneeId}
        onClose={() => setShowAssigneePicker(false)}
        onSelect={setNewTaskAssigneeId}
      />

      <Modal visible={showTaskModal} transparent animationType="slide">
        <SafeAreaView style={modal.safe}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>New task</Text>
            <Text style={modal.subtitle}>{taskTarget ? formatColumnName(taskTarget) : 'Column'}</Text>
            <TextInput
              style={modal.input}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="Task title"
              placeholderTextColor="#94A3B8"
              editable={!submitting}
              autoFocus
            />
            <View style={modal.formRow}>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => {
                  setCalendarMonth(parseDateInput(newTaskDueDate) || new Date());
                  setShowCreateDatePicker(true);
                }}
                style={modal.formPicker}
              >
                <CalendarIcon color={newTaskDueDate ? T.primary : '#64748B'} />
                <View style={modal.formPickerTextWrap}>
                  <Text style={modal.formPickerLabel}>Due date</Text>
                  <Text style={[modal.formPickerValue, newTaskDueDate && modal.formPickerValueActive]}>
                    {newTaskDueDate ? formatDate(newTaskDueDate) : 'Select date'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => setShowAssigneePicker(true)}
                style={modal.formPicker}
              >
                <UserIcon active={!!newTaskAssigneeId} />
                <View style={modal.formPickerTextWrap}>
                  <Text style={modal.formPickerLabel}>Assignee</Text>
                  <Text style={[modal.formPickerValue, selectedNewTaskAssignee && modal.formPickerValueActive]} numberOfLines={1}>
                    {selectedNewTaskAssignee?.name || 'Unassigned'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.85} disabled={submitting || !newTaskTitle.trim()} onPress={submitCreateTask} style={[modal.primaryBtn, (!newTaskTitle.trim() || submitting) && modal.disabled]}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={modal.primaryText}>Create task</Text>}
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowTaskModal(false)} style={modal.secondaryBtn}>
              <Text style={modal.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showColumnModal} transparent animationType="slide">
        <SafeAreaView style={modal.safe}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>New column</Text>
            <Text style={modal.subtitle}>Add another workflow stage</Text>
            <TextInput
              style={modal.input}
              value={newColumnName}
              onChangeText={setNewColumnName}
              placeholder="Column name"
              placeholderTextColor="#94A3B8"
              editable={!submitting}
              autoFocus
            />
            <TouchableOpacity activeOpacity={0.85} disabled={submitting || !newColumnName.trim()} onPress={submitCreateColumn} style={[modal.primaryBtn, (!newColumnName.trim() || submitting) && modal.disabled]}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={modal.primaryText}>Create column</Text>}
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowColumnModal(false)} style={modal.secondaryBtn}>
              <Text style={modal.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={[s.metric, { backgroundColor: `${accent}10`, borderColor: `${accent}24` }]}>
      <Text style={[s.metricValue, { color: accent }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18 },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bgSecondary },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F8FA',
  },
  backdropTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 330,
  },
  backdropBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
  },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingTop: 4 },
  hero: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    marginHorizontal: 14,
    marginTop: 2,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    gap: 12,
    overflow: 'hidden',
    ...shadow,
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boardMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  title: { fontSize: 21, fontWeight: '900', color: '#0F172A', marginTop: 2, letterSpacing: -0.3 },
  heroActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(239, 246, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#22C55E' },
  progressText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metric: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.78)',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', paddingVertical: 0 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.78)',
  },
  filterBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { fontSize: 12, color: '#991B1B', fontWeight: '700' },
  loadingWrap: { paddingVertical: 34, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748B', fontWeight: '700' },
  boardRow: { paddingHorizontal: 14, paddingTop: 14, gap: 14, overflow: 'visible' },
  addColumnCard: {
    minHeight: 360,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#BFDBFE',
    backgroundColor: 'rgba(248, 251, 255, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addColumnIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addColumnText: { fontSize: 15, fontWeight: '900', color: T.primary },
  bottomPad: { height: 94 },
});

const columnStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    overflow: 'visible',
    minHeight: 360,
    ...shadow,
  },
  accent: { height: 5, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 15, fontWeight: '900', color: '#0F172A' },
  headerDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wipPill: {
    minWidth: 46,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
  wipText: { color: '#DC2626' },
  body: { paddingHorizontal: 12, gap: 10, overflow: 'visible' },
  emptyState: {
    minHeight: 128,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 4,
  },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: '#64748B' },
  emptyText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  addTaskBtn: {
    margin: 12,
    marginTop: 10,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addTaskText: { fontSize: 13, fontWeight: '900', color: T.primary },
});

const card = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.72)',
    padding: 13,
    paddingTop: 14,
    zIndex: 1,
    ...shadow,
  },
  dragSurface: {
    gap: 10,
  },
  cardDragging: {
    borderColor: T.primary,
    backgroundColor: '#F8FBFF',
    zIndex: 999,
    ...Platform.select({
      ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18 },
      android: { elevation: 24 },
    }),
  },
  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 24, paddingRight: 34 },
  priority: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  iconBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    zIndex: 10,
  },
  title: { fontSize: 14, fontWeight: '900', color: '#0F172A', lineHeight: 20 },
  description: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  codePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  codeText: { fontSize: 10, fontWeight: '900', color: '#4338CA' },
  duePill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  duePillOverdue: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  duePillEmpty: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  dueDate: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  dueDateEmpty: { color: T.primary },
  overdue: { color: '#DC2626' },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  labelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  labelText: { fontSize: 10, fontWeight: '900' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 9, color: '#FFFFFF', fontWeight: '900' },
  assigneeName: { fontSize: 11, fontWeight: '800', color: '#64748B', flex: 1 },
  subtaskWrap: { alignItems: 'flex-end', gap: 4, minWidth: 70 },
  subtaskCount: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  progressTrack: { width: 70, height: 4, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: T.primary },
});

const modal = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.38)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: -4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  optionActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  optionDot: { width: 11, height: 11, borderRadius: 6 },
  optionText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  currentText: { fontSize: 11, fontWeight: '900', color: T.primary },
  assigneeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeAvatarActive: {
    backgroundColor: T.primary,
  },
  assigneeAvatarText: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  assigneeAvatarTextActive: { color: '#FFFFFF' },
  emptyOption: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOptionText: { fontSize: 13, fontWeight: '800', color: '#94A3B8' },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
  },
  formRow: { gap: 10 },
  formPicker: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formPickerTextWrap: { flex: 1, minWidth: 0 },
  formPickerLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.7, textTransform: 'uppercase' },
  formPickerValue: { fontSize: 13, fontWeight: '900', color: '#64748B', marginTop: 2 },
  formPickerValueActive: { color: '#0F172A' },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
  },
  disabled: { opacity: 0.55 },
  primaryText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  secondaryText: { fontSize: 14, fontWeight: '900', color: '#64748B' },
});

const dateModal = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.38)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 14,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 2 },
  monthRow: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthBtnText: { fontSize: 18, fontWeight: '900', color: '#64748B' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '900', color: '#0F172A' },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '900', color: '#94A3B8' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: {
    width: '13.45%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayEmpty: {
    opacity: 0,
  },
  dayToday: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  daySelected: {
    borderColor: T.primary,
    backgroundColor: T.primary,
  },
  dayText: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
  dayTodayText: { color: T.primary },
  daySelectedText: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 10 },
  clearBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 14, fontWeight: '900', color: '#64748B' },
  doneBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
});
