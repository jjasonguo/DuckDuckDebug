import random


def bogobogo_sort(arr):
    while not is_sorted(arr):
        shuffle(arr)
        print(f"Trying: {arr}")


def is_sorted(arr):
    return is_sorted_prefix(arr, len(arr))


def is_sorted_prefix(arr, n):
    if n <= 1:
        return True
    prefix = arr[:n - 1].copy()
    bogobogo_sort(prefix)
    for i in range(n - 2):
        if prefix[i] > prefix[i + 1]:
            return False
    return arr[n - 2] <= arr[n - 1]


def shuffle(arr):
    for i in range(len(arr)):
        j = random.randint(0, len(arr) - 1)
        arr[i], arr[j] = arr[j], arr[i]


if __name__ == "__main__":
    data = [3, 2, 1]  # WARNING: More than 3 elements is pain
    bogobogo_sort(data)
    print("Sorted:", " ".join(map(str, data)))
