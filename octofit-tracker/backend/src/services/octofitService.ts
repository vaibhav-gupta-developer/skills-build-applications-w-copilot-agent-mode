import { Activity, Team, User, Workout } from '../models/index.js';
import { Types } from 'mongoose';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const objectIdPattern = /^[\da-f]{24}$/i;

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) {
    throw Object.assign(new Error('Activity input must be an object'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input;
  if (typeof userId !== 'string' || !objectIdPattern.test(userId) || typeof teamId !== 'string' || !objectIdPattern.test(teamId)) {
    throw Object.assign(new Error('Activity userId and teamId must be valid IDs'), { status: 400 });
  }
  if (typeof type !== 'string' || !type.trim() || typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw Object.assign(new Error('Activity type and positive minutes are required'), { status: 400 });
  }

  const [user, team] = await Promise.all([User.exists({ _id: userId }), Team.exists({ _id: teamId })]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity userId and teamId must refer to existing records'), { status: 400 });
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) {
    throw Object.assign(new Error('Team input must be an object'), { status: 400 });
  }

  const { name, mascot } = input;
  const members = input.members ?? [];
  if (typeof name !== 'string' || !name.trim()) {
    throw Object.assign(new Error('Team name is required'), { status: 400 });
  }
  if (typeof mascot !== 'string' || !mascot.trim()) {
    throw Object.assign(new Error('Team mascot is required'), { status: 400 });
  }
  if (!Array.isArray(members)) {
    throw Object.assign(new Error('Team members must be an array'), { status: 400 });
  }

  const memberIds: string[] = [];
  for (const member of members) {
    if (typeof member !== 'string' || !objectIdPattern.test(member)) {
      throw Object.assign(new Error('Team members must be valid user IDs'), { status: 400 });
    }
    memberIds.push(member);
  }
  if (memberIds.length > 0) {
    const existingMembers = await User.countDocuments({ _id: { $in: memberIds } });
    if (existingMembers !== new Set(memberIds).size) {
      throw Object.assign(new Error('Team members must refer to existing users'), { status: 400 });
    }
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const [teams, pointTotals] = await Promise.all([
    Team.find().lean(),
    Activity.aggregate<{ _id: Types.ObjectId; totalPoints: number }>([
      { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    ]),
  ]);
  const totalsByTeam = new Map(pointTotals.map(({ _id, totalPoints }) => [_id.toString(), totalPoints]));
  const rankedTeams = teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: totalsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName));

  return rankedTeams.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const [recentActivity, workouts] = await Promise.all([
    Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).lean(),
    Workout.find().lean(),
  ]);
  const goalFocus = user.fitnessGoal.trim().toLowerCase();
  const activityType = recentActivity?.type.trim().toLowerCase();
  const activityFocus = activityType
    ? ({ run: 'endurance', cycle: 'endurance', strength: 'strength' }[activityType] ?? activityType)
    : undefined;
  const preferredFocuses = [...new Set([goalFocus, activityFocus].filter((focus): focus is string => Boolean(focus)))];
  const matchingWorkouts = preferredFocuses.flatMap((focus) =>
    workouts.filter((workout) => workout.focus.toLowerCase() === focus),
  );
  const reason = recentActivity
    ? `Recommended for your ${user.fitnessGoal} goal and recent ${recentActivity.type} activity.`
    : `Recommended for your ${user.fitnessGoal} goal.`;

  return matchingWorkouts.map((workout) => ({ ...workout, reason }));
}

export { User };
