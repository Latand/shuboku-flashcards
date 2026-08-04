def sm_algorithm(user_grade, n_repetitions=0, easiness_factor=2.5, interval=0):
    """
    SuperMemo algorithm

    :param user_grade: 0-5
    :param n_repetitions:
    :param easiness_factor: calculated from the last repetition
    :param interval: in days
    :return:
    """
    if user_grade >= 3:
        if n_repetitions == 0:
            interval = 1
        elif n_repetitions == 1:
            interval = 6
        else:
            interval = round(interval * easiness_factor)
        n_repetitions += 1
    else:
        n_repetitions = 0
        interval = 1
    easiness_factor += (0.1 - (5 - user_grade) * (0.08 + (5 - user_grade) * 0.02))
    easiness_factor = max(1.3, easiness_factor)
    return n_repetitions, easiness_factor, interval
