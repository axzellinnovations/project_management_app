import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { T, STATUS_MAP, StatusKey } from '../../constants/tokens';
import {
  MobileSprint,
  MobileTask,
  useMobileBacklog,
} from '../../hooks/useMobileBacklog';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
function Icon({ name, color = T.primary, size = 18 }: { name: 'plus' | 'search' | 'filter' | 'trash' | 'check' | 'rocket' | 'box' | 'move' | 'chart' | 'user' | 'tag' | 'flag'; color?: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'search') return <Svg {...p}><Circle cx={11} cy={11} r={8} /><Path d="m21 21-4.3-4.3" /></Svg>;
  if (name === 'filter') return <Svg {...p}><Path d="M3 5h18" /><Path d="M7 12h10" /><Path d="M10 19h4" /></Svg>;
  if (name === 'trash') return <Svg {...p}><Path d="M3 6h18" /><Path d="M8 6V4h8v2" /><Path d="M19 6l-1 14H6L5 6" /></Svg>;
  if (name === 'check') return <Svg {...p}><Path d="M20 6 9 17l-5-5" /></Svg>;
  if (name === 'rocket') return <Svg {...p}><Path d="M4.5 16.5c-1 1-1.5 2.5-1.5 4.5 2 0 3.5-.5 4.5-1.5" /><Path d="M9 15 5 11l4-4c3.5-3.5 7-4.5 11-4-0.5 4-1.5 7.5-5 11l-4 4-4-4" /><Circle cx={15} cy={9} r={1.5} /></Svg>;
  if (name === 'box') return <Svg {...p}><Rect x={4} y={4} width={16} height={16} rx={3} /><Path d="M8 9h8" /><Path d="M8 14h5" /></Svg>;
  if (name === 'move') return <Svg {...p}><Path d="M5 12h14" /><Path d="m13 6 6 6-6 6" /></Svg>;
  if (name === 'chart') return <Svg {...p}><Rect x={4} y={12} width={3} height={7} rx={1} /><Rect x={10.5} y={5} width={3} height={14} rx={1} /><Rect x={17} y={9} width={3} height={10} rx={1} /></Svg>;
  if (name === 'user') return <Svg {...p}><Circle cx={12} cy={7} r={4} /><Path d="M5 21v-2a7 7 0 0 1 14 0v2" /></Svg>;
  if (name === 'tag') return <Svg {...p}><Path d="M20 13 11 22l-9-9V4h9l9 9z" /><Circle cx={7.5} cy={8.5} r={1.5} /></Svg>;
  if (name === 'flag') return <Svg {...p}><Path d="M4 22V4" /><Path d="M4 5h12l-1 5 1 5H4" /></Svg>;
  return <Svg {...p}><Path d="M12 5v14" /><Path d="M5 12h14" /></Svg>;
}

function BacklogBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient
        colors={['rgba(21, 93, 252, 0.15)', 'rgba(34, 197, 94, 0.09)', 'rgba(247, 248, 250, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdropTop}
      />
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.08)', 'rgba(139, 92, 246, 0.07)', 'rgba(247, 248, 250, 0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backdropBottom}
      />
    </View>
  );
}

function statusStyle(status?: string | null) {
  return STATUS_MAP[(status || 'TODO') as StatusKey] ?? T.statusTodo;
}

function priorityColor(priority?: string | null) {
  if (priority === 'URGENT' || priority === 'HIGH') return '#EF4444';
  if (priority === 'MEDIUM') return '#F59E0B';
  return '#22C55E';
}

function formatDate(value?: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name?: string | null) {
  if (!name || name === 'Unassigned') return '--';
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function TaskCard({
  task,
  selected,
  agile,
  sprints,
  onToggle,
  onStatus,
  onDelete,
  onPoints,
  onMove,
}: {
  task: MobileTask;
  selected: boolean;
  agile?: boolean;
  sprints: MobileSprint[];
  onToggle: () => void;
  onStatus: (status: string) => void;
  onDelete: () => void;
  onPoints?: (points: number) => void;
  onMove?: (sprintId: number | null) => void;
}) {
  const status = statusStyle(task.status);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={[styles.taskCard, selected && styles.taskCardSelected]}>
      <TouchableOpacity activeOpacity={0.75} onPress={onToggle} style={[styles.checkBox, selected && styles.checkBoxActive]}>
        {selected && <Icon name="check" color="#FFFFFF" size={13} />}
      </TouchableOpacity>

      <View style={styles.taskMain}>
        <View style={styles.taskTop}>
          <Text style={styles.taskCode}>TSK-{task.projectTaskNumber ?? task.id}</Text>
          <View style={[styles.priorityPill, { backgroundColor: `${priorityColor(task.priority)}12`, borderColor: `${priorityColor(task.priority)}30` }]}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]} />
            <Text style={[styles.priorityText, { color: priorityColor(task.priority) }]}>{task.priority || 'MEDIUM'}</Text>
          </View>
        </View>
        <Text style={[styles.taskTitle, task.status === 'DONE' && styles.doneTitle]} numberOfLines={2}>{task.title}</Text>

        <View style={styles.metaRow}>
          <TouchableOpacity activeOpacity={0.75} onPress={() => setMenuOpen(true)} style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{(task.status || 'TODO').replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(task.dueDate)}</Text>
          <View style={styles.assigneeWrap}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(task.assigneeName)}</Text></View>
            <Text style={styles.assigneeText} numberOfLines={1}>{task.assigneeName || 'Unassigned'}</Text>
          </View>
        </View>

        {!!task.labels?.length && (
          <View style={styles.labelRow}>
            {task.labels.slice(0, 2).map((label) => {
              const color = label.color?.startsWith('#') ? label.color : T.primary;
              return (
                <View key={label.id} style={[styles.labelPill, { backgroundColor: `${color}14`, borderColor: `${color}28` }]}>
                  <Text style={[styles.labelText, { color }]}>{label.name}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.taskActions}>
        {agile && (
          <TouchableOpacity activeOpacity={0.75} onPress={() => onPoints?.((task.storyPoint ?? 0) + 1)} style={styles.pointsBtn}>
            <Text style={styles.pointsValue}>{task.storyPoint ?? 0}</Text>
            <Text style={styles.pointsLabel}>pts</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity activeOpacity={0.75} onPress={onDelete} style={styles.iconBtnDanger}>
          <Icon name="trash" color="#DC2626" size={15} />
        </TouchableOpacity>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setMenuOpen(false)} style={styles.centerOverlay}>
          <View style={styles.popover}>
            <Text style={styles.popoverTitle}>Task actions</Text>
            <Text style={styles.popoverSub}>{task.title}</Text>
            <View style={styles.optionGrid}>
              {STATUSES.map((statusOption) => (
                <TouchableOpacity key={statusOption} activeOpacity={0.75} onPress={() => { onStatus(statusOption); setMenuOpen(false); }} style={styles.optionBtn}>
                  <Text style={styles.optionBtnText}>{statusOption.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {agile && onMove && (
              <View style={styles.moveList}>
                <TouchableOpacity activeOpacity={0.75} onPress={() => { onMove(null); setMenuOpen(false); }} style={styles.moveRow}>
                  <Icon name="box" color={T.primary} size={16} />
                  <Text style={styles.moveText}>Move to backlog</Text>
                </TouchableOpacity>
                {sprints.map((sprint) => (
                  <TouchableOpacity key={sprint.id} activeOpacity={0.75} onPress={() => { onMove(sprint.id); setMenuOpen(false); }} style={styles.moveRow}>
                    <Icon name="move" color={T.primary} size={16} />
                    <Text style={styles.moveText}>Move to {sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function FilterSheet({
  visible,
  value,
  options,
  title,
  getLabel,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  options: string[];
  title: string;
  getLabel?: (option: string) => string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.sheetSafe}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {options.map((option) => {
            const active = value === option;
            const label = getLabel ? getLabel(option) : option === 'ALL' ? 'All' : option.replace(/_/g, ' ');
            return (
              <TouchableOpacity key={option} activeOpacity={0.75} onPress={() => { onSelect(option); onClose(); }} style={[styles.sheetOption, active && styles.sheetOptionActive]}>
                <View style={[styles.optionDot, active && styles.optionDotActive]} />
                <Text style={styles.sheetOptionText}>{label}</Text>
                {active && <Text style={styles.selectedText}>Selected</Text>}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CreateSheet({
  visible,
  title,
  placeholder,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheetSafe}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            style={styles.input}
            autoFocus
          />
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!value.trim()) return;
              onSubmit(value);
              setValue('');
              onClose();
            }}
            style={[styles.primaryBtn, !value.trim() && styles.disabledBtn]}
            disabled={!value.trim()}
          >
            <Text style={styles.primaryText}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Header({
  agile,
  stats,
  onCreateTask,
  onCreateSprint,
}: {
  agile: boolean;
  stats: { total: number; done: number; points: number; sprints: number };
  onCreateTask: () => void;
  onCreateSprint?: () => void;
}) {
  const completion = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.glassLayer}>
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.glassWash} />
      </View>
      <View style={styles.heroTop}>
        <LinearGradient
          colors={agile ? ['#7C3AED', '#A855F7'] : [T.primary, '#4D8BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroIcon}
        >
          <Icon name={agile ? 'rocket' : 'box'} color="#FFFFFF" size={19} />
        </LinearGradient>
        <View style={styles.heroTitleWrap}>
          <Text style={styles.eyebrow}>{agile ? 'AGILE BACKLOG' : 'KANBAN BACKLOG'}</Text>
          <Text style={styles.title}>{agile ? 'Sprint planning' : 'Product backlog'}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={onCreateTask} style={styles.headerIconBtn}>
          <Icon name="plus" color={T.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
        <Text style={styles.progressText}>{completion}% done</Text>
      </View>

      <View style={styles.statRow}>
        <Stat label="Tasks" value={stats.total} color={T.primary} />
        <Stat label="Done" value={stats.done} color="#22C55E" />
        <Stat label={agile ? 'Points' : 'Sprints'} value={agile ? stats.points : stats.sprints} color={agile ? '#8B5CF6' : '#F59E0B'} />
      </View>

      {agile && onCreateSprint && (
        <TouchableOpacity activeOpacity={0.8} onPress={onCreateSprint} style={styles.createSprintBtn}>
          <Icon name="rocket" color="#FFFFFF" size={16} />
          <Text style={styles.createSprintText}>Create sprint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: `${color}10`, borderColor: `${color}24` }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BulkBar({
  selectedCount,
  agile,
  sprints,
  onClear,
  onDone,
  onDelete,
  onMove,
}: {
  selectedCount: number;
  agile: boolean;
  sprints: MobileSprint[];
  onClear: () => void;
  onDone: () => void;
  onDelete: () => void;
  onMove: (sprintId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!selectedCount) return null;

  return (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkText}>{selectedCount} selected</Text>
      {agile && (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(true)} style={styles.bulkBtn}>
          <Icon name="move" color={T.primary} size={15} />
          <Text style={styles.bulkBtnText}>Move</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity activeOpacity={0.8} onPress={onDone} style={styles.bulkBtn}>
        <Icon name="check" color={T.primary} size={15} />
        <Text style={styles.bulkBtnText}>Done</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert('Delete tasks', 'Only Owners and Admins can delete tasks.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ])} style={styles.bulkDangerBtn}>
        <Icon name="trash" color="#DC2626" size={15} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={onClear} style={styles.bulkClearBtn}><Text style={styles.bulkClearText}>Clear</Text></TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={styles.centerOverlay}>
          <View style={styles.popover}>
            <Text style={styles.popoverTitle}>Move selected tasks</Text>
            <TouchableOpacity activeOpacity={0.75} onPress={() => { onMove(null); setOpen(false); }} style={styles.moveRow}>
              <Icon name="box" color={T.primary} size={16} />
              <Text style={styles.moveText}>Move to backlog</Text>
            </TouchableOpacity>
            {sprints.map((sprint) => (
              <TouchableOpacity key={sprint.id} activeOpacity={0.75} onPress={() => { onMove(sprint.id); setOpen(false); }} style={styles.moveRow}>
                <Icon name="move" color={T.primary} size={16} />
                <Text style={styles.moveText}>Move to {sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function FilterBar({
  filters,
  assignees,
  labels,
  setFilters,
}: {
  filters: ReturnType<typeof useMobileBacklog>['filters'];
  assignees: string[];
  labels: ReturnType<typeof useMobileBacklog>['allLabels'];
  setFilters: ReturnType<typeof useMobileBacklog>['setFilters'];
}) {
  const [sheet, setSheet] = useState<'status' | 'priority' | 'assignee' | 'label' | null>(null);
  return (
    <View style={styles.filters}>
      <View style={styles.searchWrap}>
        <Icon name="search" color="#94A3B8" size={15} />
        <TextInput
          value={filters.search}
          onChangeText={(search) => setFilters((current) => ({ ...current, search }))}
          placeholder="Search tasks..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
      </View>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('status')} style={[styles.filterBtn, filters.status !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="filter" color={filters.status !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('priority')} style={[styles.filterBtn, filters.priority !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="flag" color={filters.priority !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('assignee')} style={[styles.filterBtn, filters.assignee !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="user" color={filters.assignee !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('label')} style={[styles.filterBtn, filters.label !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="tag" color={filters.label !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>

      <FilterSheet
        visible={sheet === 'status'}
        value={filters.status}
        options={['ALL', ...STATUSES]}
        title="Status"
        onClose={() => setSheet(null)}
        onSelect={(status) => setFilters((current) => ({ ...current, status }))}
      />
      <FilterSheet
        visible={sheet === 'priority'}
        value={filters.priority}
        options={['ALL', ...PRIORITIES]}
        title="Priority"
        onClose={() => setSheet(null)}
        onSelect={(priority) => setFilters((current) => ({ ...current, priority }))}
      />
      <FilterSheet
        visible={sheet === 'assignee'}
        value={filters.assignee}
        options={['ALL', ...assignees, 'Unassigned']}
        title="Assignee"
        onClose={() => setSheet(null)}
        onSelect={(assignee) => setFilters((current) => ({ ...current, assignee }))}
      />
      <FilterSheet
        visible={sheet === 'label'}
        value={filters.label}
        options={['ALL', ...labels.map((label) => String(label.id))]}
        title="Label"
        getLabel={(option) => option === 'ALL' ? 'All' : labels.find((label) => String(label.id) === option)?.name ?? option}
        onClose={() => setSheet(null)}
        onSelect={(label) => setFilters((current) => ({ ...current, label }))}
      />
    </View>
  );
}

export default function MobileBacklogScreen({
  projectId,
  isAgile,
  topOffset = 0,
}: {
  projectId: number;
  projectName?: string;
  isAgile: boolean;
  topOffset?: number;
}) {
  const backlog = useMobileBacklog(projectId);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState<number | null>(null);

  const sprintOptions = useMemo(
    () => backlog.sprints.filter((sprint) => sprint.status !== 'COMPLETED'),
    [backlog.sprints]
  );

  const openCreateTask = (sprintId: number | null = null) => {
    setTargetSprintId(sprintId);
    setCreateTaskOpen(true);
  };

  const stats = useMemo(() => {
    const visibleTasks = isAgile
      ? [
          ...backlog.filteredSprints.flatMap((sprint) => sprint.tasks),
          ...backlog.filteredProductTasks,
        ]
      : backlog.groupedProductTasks.flatMap((group) => group.tasks);
    const total = visibleTasks.length;
    const done = visibleTasks.filter((task) => task.status === 'DONE').length;
    const points = visibleTasks.reduce((sum, task) => sum + (task.storyPoint ?? 0), 0);
    return { total, done, points, sprints: backlog.filteredSprints.length };
  }, [backlog.filteredProductTasks, backlog.filteredSprints, backlog.groupedProductTasks, isAgile]);

  if (backlog.loading) {
    return (
      <View style={[styles.loading, { paddingTop: topOffset }]}>
        <ActivityIndicator color={T.primary} />
        <Text style={styles.loadingText}>Loading backlog...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <BacklogBackdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topOffset }]}
        refreshControl={<RefreshControl refreshing={backlog.refreshing} onRefresh={backlog.refresh} tintColor={T.primary} colors={[T.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        <Header
          agile={isAgile}
          stats={stats}
          onCreateTask={() => openCreateTask(null)}
          onCreateSprint={isAgile ? () => setCreateSprintOpen(true) : undefined}
        />

        <FilterBar
          filters={backlog.filters}
          assignees={backlog.allAssigneeNames}
          labels={backlog.allLabels}
          setFilters={backlog.setFilters}
        />

        {!!backlog.error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Backlog error</Text>
            <Text style={styles.errorText}>{backlog.error}</Text>
          </View>
        )}

        {isAgile ? (
          <View style={styles.sections}>
            {backlog.filteredSprints.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Icon name="rocket" color="#94A3B8" size={28} />
                <Text style={styles.emptyTitle}>No active sprints</Text>
                <Text style={styles.emptyText}>Create a sprint to start planning development work.</Text>
              </View>
            ) : (
              backlog.filteredSprints.map((sprint) => (
                <View key={sprint.id} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.sectionTitle}>{sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}</Text>
                      <Text style={styles.sectionSub}>{sprint.tasks.length} tasks</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => openCreateTask(sprint.id)} style={styles.smallPrimary}>
                      <Icon name="plus" color="#FFFFFF" size={14} />
                    </TouchableOpacity>
                  </View>
                  {sprint.tasks.length === 0 ? (
                    <Text style={styles.mutedLine}>No matching tasks in this sprint.</Text>
                  ) : sprint.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selected={!!task.selected}
                      agile
                      sprints={sprintOptions}
                      onToggle={() => backlog.toggleTaskSelection(task.id)}
                      onStatus={(status) => backlog.updateStatus(task.id, status)}
                      onDelete={() => backlog.deleteTask(task.id)}
                      onPoints={(points) => backlog.updateStoryPoints(task.id, points)}
                      onMove={(sprintId) => backlog.moveTaskToSprint(task.id, sprintId)}
                    />
                  ))}
                </View>
              ))
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Product backlog</Text>
                  <Text style={styles.sectionSub}>{backlog.filteredProductTasks.length} unscheduled tasks</Text>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => openCreateTask(null)} style={styles.smallPrimary}>
                  <Icon name="plus" color="#FFFFFF" size={14} />
                </TouchableOpacity>
              </View>
              {backlog.filteredProductTasks.length === 0 ? (
                <Text style={styles.mutedLine}>No matching backlog tasks.</Text>
              ) : backlog.filteredProductTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={!!task.selected}
                  agile
                  sprints={sprintOptions}
                  onToggle={() => backlog.toggleTaskSelection(task.id)}
                  onStatus={(status) => backlog.updateStatus(task.id, status)}
                  onDelete={() => backlog.deleteTask(task.id)}
                  onPoints={(points) => backlog.updateStoryPoints(task.id, points)}
                  onMove={(sprintId) => backlog.moveTaskToSprint(task.id, sprintId)}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.sections}>
            {backlog.groupedProductTasks.map((group) => (
              <View key={group.label} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>{group.label}</Text>
                    <Text style={styles.sectionSub}>{group.tasks.length} tasks</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => openCreateTask(null)} style={styles.smallPrimary}>
                    <Icon name="plus" color="#FFFFFF" size={14} />
                  </TouchableOpacity>
                </View>
                {group.tasks.length === 0 ? (
                  <Text style={styles.mutedLine}>No matching backlog tasks.</Text>
                ) : group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={!!task.selected}
                    sprints={[]}
                    onToggle={() => backlog.toggleTaskSelection(task.id)}
                    onStatus={(status) => backlog.updateStatus(task.id, status)}
                    onDelete={() => backlog.deleteTask(task.id)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      <CreateSheet
        visible={createTaskOpen}
        title={targetSprintId ? 'New sprint task' : 'New backlog task'}
        placeholder="Task title"
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={(title) => backlog.createTask(title, targetSprintId)}
      />

      <CreateSheet
        visible={createSprintOpen}
        title="New sprint"
        placeholder="Sprint name"
        onClose={() => setCreateSprintOpen(false)}
        onSubmit={backlog.createSprint}
      />

      <BulkBar
        selectedCount={backlog.selectedCount}
        agile={isAgile}
        sprints={sprintOptions}
        onClear={backlog.clearSelection}
        onDone={() => backlog.bulkStatus('DONE')}
        onDelete={backlog.bulkDelete}
        onMove={backlog.bulkMoveToSprint}
      />
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18 },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
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
    height: 340,
  },
  backdropBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
  },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 14, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: T.bgSecondary },
  loadingText: { fontSize: 13, fontWeight: '700', color: T.textSecondary },
  hero: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    padding: 14,
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
  heroIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroIconAgile: {},
  heroTitleWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  title: { fontSize: 21, fontWeight: '900', color: '#0F172A', marginTop: 2, letterSpacing: -0.3 },
  headerIconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(239, 246, 255, 0.92)', borderWidth: 1, borderColor: 'rgba(191, 219, 254, 0.95)', alignItems: 'center', justifyContent: 'center' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#22C55E' },
  progressText: { fontSize: 11, fontWeight: '800', color: T.textSecondary },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.44)' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', color: T.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  createSprintBtn: { height: 42, borderRadius: 12, backgroundColor: T.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createSprintText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    padding: 8,
    ...shadow,
  },
  searchWrap: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.78)', backgroundColor: 'rgba(248, 250, 252, 0.82)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', paddingVertical: 0 },
  filterBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.78)', backgroundColor: 'rgba(248, 250, 252, 0.82)', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  filterLetter: { fontSize: 13, fontWeight: '900', color: '#64748B' },
  filterLetterActive: { color: T.primary },
  errorBox: { borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12 },
  errorTitle: { fontSize: 13, fontWeight: '900', color: '#991B1B' },
  errorText: { fontSize: 12, fontWeight: '700', color: '#B91C1C', marginTop: 2 },
  sections: { gap: 14 },
  section: { backgroundColor: 'rgba(255, 255, 255, 0.88)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', padding: 12, gap: 10, ...shadow },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  sectionSub: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 2 },
  smallPrimary: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8 }, android: { elevation: 3 } }) },
  mutedLine: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
  emptyPanel: { minHeight: 150, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: '#64748B' },
  emptyText: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
  taskCard: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.72)', backgroundColor: 'rgba(255, 255, 255, 0.96)', padding: 11, ...shadow },
  taskCardSelected: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  checkBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  checkBoxActive: { backgroundColor: T.primary, borderColor: T.primary },
  taskMain: { flex: 1, minWidth: 0, gap: 8 },
  taskTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskCode: { fontSize: 11, fontWeight: '900', color: '#64748B' },
  priorityPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 9, fontWeight: '900' },
  taskTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', lineHeight: 19 },
  doneTitle: { color: '#94A3B8', textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '900' },
  dateText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  assigneeWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 140 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  assigneeText: { flex: 1, fontSize: 11, fontWeight: '800', color: '#64748B' },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  labelPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  labelText: { fontSize: 10, fontWeight: '900' },
  taskActions: { alignItems: 'center', gap: 8 },
  iconBtnDanger: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  pointsBtn: { width: 34, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  pointsValue: { fontSize: 15, fontWeight: '900', color: '#8B5CF6' },
  pointsLabel: { fontSize: 8, fontWeight: '900', color: '#8B5CF6' },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  popover: { width: '100%', maxWidth: 360, borderRadius: 18, backgroundColor: '#FFFFFF', padding: 16, gap: 10 },
  popoverTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  popoverSub: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: -6 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { minHeight: 38, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', justifyContent: 'center' },
  optionBtnText: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
  moveList: { gap: 8, paddingTop: 4 },
  moveRow: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  moveText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  sheetSafe: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.38)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  sheetOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  optionDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#CBD5E1' },
  optionDotActive: { backgroundColor: T.primary },
  sheetOptionText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  selectedText: { fontSize: 11, fontWeight: '900', color: T.primary },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 14, fontSize: 14, color: '#0F172A' },
  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary },
  disabledBtn: { opacity: 0.55 },
  primaryText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  secondaryBtn: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  secondaryText: { fontSize: 14, fontWeight: '900', color: '#64748B' },
  bulkBar: { position: 'absolute', left: 12, right: 12, bottom: 16, minHeight: 58, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, ...shadow },
  bulkText: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  bulkBtn: { height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  bulkBtnText: { fontSize: 12, fontWeight: '900', color: T.primary },
  bulkDangerBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  bulkClearBtn: { height: 38, justifyContent: 'center', paddingHorizontal: 4 },
  bulkClearText: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  bottomPad: { height: 100 },
});
